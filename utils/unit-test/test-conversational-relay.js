import Fastify from "fastify";
import fastifyWs from "@fastify/websocket";
import {AzureOpenAI} from "openai";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 8080;
const DOMAIN = process.env.NGROK_URL;
const WS_URL = `wss://${DOMAIN}/ws`;
const WELCOME_GREETING = "嗨！我是由 Twilio 和 Open AI 提供支援的語音助理。有什麼問題可以問我！";
const SYSTEM_PROMPT = "You are a helpful assistant. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols.";
const sessions = new Map();
const deployment = process.env.OPENAI_DEPLOYMENT_NAME_GPT4;
const apiVersion = "2024-12-01-preview";

const client = new AzureOpenAI({
  apiKey: process.env.OPENAI_API_KEY_GPT4,
  endpoint: process.env.OPENAI_DEPLOYMENT_ENDPOINT_GPT4,
  apiVersion: apiVersion,
});

async function aiResponse(conversation) {
  try {
    const response = await client.chat.completions.create({
      model: deployment,
      messages: conversation,
      max_tokens: 150,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error getting AI response:", error);
    return "Sorry, I'm having trouble processing your request right now.";
  }
}

const fastify = Fastify();
fastify.register(fastifyWs);

// Outbound call endpoint using Twilio REST API
fastify.post("/call", async (request, reply) => {
  try {
    const { to } = request.body || {};
    if (!to) {
      return reply.code(400).send({ error: "Missing 'to' phone number" });
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !from) {
      return reply.code(500).send({ error: "Twilio credentials not configured in .env" });
    }

    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const voiceUrl = `https://${DOMAIN}/twiml`;

    const params = new URLSearchParams();
    params.append("To", to);
    params.append("From", from);
    params.append("Url", voiceUrl);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      return reply.code(res.status).send({ error: data });
    }
    return reply.send({ sid: data.sid, status: data.status });
  } catch (err) {
    console.error("Error creating outbound call:", err);
    return reply.code(500).send({ error: "Failed to create outbound call" });
  }
});

const twimlHandler = async (request, reply) => {
  reply.type("text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <ConversationRelay
          url="${WS_URL}"
          welcomeGreeting="${WELCOME_GREETING}"
          voice="21m00Tcm4TlvDq8ikWAM"
          language="en-US"
          dtmfDetection="true"
        />
      </Connect>
    </Response>`
  );
};
fastify.get("/twiml", twimlHandler);
fastify.post("/twiml", twimlHandler);
fastify.register(async function (fastify) {
 fastify.get("/ws", { websocket: true }, (ws, req) => {
   ws.on("message", async (data) => {
     const message = JSON.parse(data);
     switch (message.type) {
       case "setup":
         const callSid = message.callSid;
         console.log("Setup for call:", callSid);
         ws.callSid = callSid;
         sessions.set(callSid, [{ role: "system", content: SYSTEM_PROMPT }]);
         break;
       case "prompt":
         console.log("Processing prompt:", message.voicePrompt);
         const conversation = sessions.get(ws.callSid);
         conversation.push({ role: "user", content: message.voicePrompt });
         const response = await aiResponse(conversation);
         conversation.push({ role: "assistant", content: response });
         ws.send(
           JSON.stringify({
             type: "text",
             token: response,
             last: true,
           })
         );
         console.log("Sent response:", response);
         break;
       case "interrupt":
         console.log("Handling interruption.");
         break;
       default:
         console.warn("Unknown message type received:", message.type);
         break;
     }
   });
   ws.on("close", () => {
     console.log("WebSocket connection closed");
     sessions.delete(ws.callSid);
   });
 });
});
try {
 fastify.listen({ port: PORT });
 console.log(`Server running at http://localhost:${PORT} and wss://${DOMAIN}/ws`);
} catch (err) {
 fastify.log.error(err);
 process.exit(1);
}