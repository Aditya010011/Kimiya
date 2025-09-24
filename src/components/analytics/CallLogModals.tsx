import React, { useState, useRef } from 'react';
import {
  FileText,
  Eye,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Download,
  Copy,
  MapPin,
  Clock,
  Phone,
  User,
  Globe,
  Wifi,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
// import { Slider } from '@/components/ui/slider'; // Component doesn't exist, using custom implementation
import { toast } from 'sonner';
import { CallRecord } from '@/types/userAnalytics';

interface CallLogModalsProps {
  selectedCall: CallRecord | null;
  transcriptionModalOpen: boolean;
  summaryModalOpen: boolean;
  recordingModalOpen: boolean;
  detailsModalOpen: boolean;
  onCloseTranscription: () => void;
  onCloseSummary: () => void;
  onCloseRecording: () => void;
  onCloseDetails: () => void;
}

const CallLogModals: React.FC<CallLogModalsProps> = ({
  selectedCall,
  transcriptionModalOpen,
  summaryModalOpen,
  recordingModalOpen,
  detailsModalOpen,
  onCloseTranscription,
  onCloseSummary,
  onCloseRecording,
  onCloseDetails
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phoneNumber;
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume / 100;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const handleCopyTranscription = () => {
    if (selectedCall?.transcription) {
      navigator.clipboard.writeText(selectedCall.transcription);
      toast.success('Transcription copied to clipboard');
    }
  };

  const handleDownloadTranscription = () => {
    if (selectedCall?.transcription) {
      const blob = new Blob([selectedCall.transcription], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `call-transcription-${selectedCall.call_id}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Transcription downloaded');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'answered': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'declined': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'busy': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'no-answer': return <AlertCircle className="h-4 w-4 text-gray-500" />;
      case 'hung-up': return <XCircle className="h-4 w-4 text-orange-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'cancelled': return <XCircle className="h-4 w-4 text-gray-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getQualityColor = (quality?: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-blue-600';
      case 'fair': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <>
      {/* Transcription Modal */}
      <Dialog open={transcriptionModalOpen} onOpenChange={onCloseTranscription}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Call Transcription
            </DialogTitle>
            <DialogDescription>
              Complete conversation transcript for call {selectedCall?.call_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCall && (
            <div className="space-y-4">
              {/* Call Info */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium">{formatPhoneNumber(selectedCall.from_number)} → {formatPhoneNumber(selectedCall.to_number)}</p>
                    <p className="text-sm text-gray-500">{new Date(selectedCall.start_time).toLocaleString()}</p>
                  </div>
                  <Badge variant="outline">{formatDuration(selectedCall.duration)}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleCopyTranscription}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadTranscription}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>

              {/* Transcription Content */}
              <Card>
                <CardContent className="p-6">
                  <ScrollArea className="h-96 w-full">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedCall.transcription || 'No transcription available for this call.'}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Summary Modal */}
      <Dialog open={summaryModalOpen} onOpenChange={onCloseSummary}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Call Summary
            </DialogTitle>
            <DialogDescription>
              AI-generated summary and analysis for call {selectedCall?.call_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCall && (
            <div className="space-y-4">
              {/* Call Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-600">Duration</p>
                  <p className="text-lg font-semibold">{formatDuration(selectedCall.duration)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <div className="flex items-center gap-1 mt-1">
                    {getStatusIcon(selectedCall.status)}
                    <span className="capitalize">{selectedCall.status.replace('-', ' ')}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Cost</p>
                  <p className="text-lg font-semibold">${selectedCall.cost.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Quality</p>
                  <p className={`text-lg font-semibold ${getQualityColor(selectedCall.metadata.network_quality)}`}>
                    {selectedCall.metadata.network_quality || 'Unknown'}
                  </p>
                </div>
              </div>

              {/* AI Analysis */}
              {selectedCall.analysis && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Call Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Outcome</p>
                        <Badge variant={selectedCall.analysis.outcome === 'successful' ? 'default' : 'secondary'}>
                          {selectedCall.analysis.outcome.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Sentiment Score</p>
                        <div className="flex items-center gap-2">
                          <Progress value={(selectedCall.analysis.sentiment_score + 1) * 50} className="flex-1" />
                          <span className="text-sm font-medium">
                            {selectedCall.analysis.sentiment_score > 0.3 ? 'Positive' : 
                             selectedCall.analysis.sentiment_score < -0.3 ? 'Negative' : 'Neutral'}
                          </span>
                        </div>
                      </div>
                      {selectedCall.analysis.customer_satisfaction && (
                        <div>
                          <p className="text-sm font-medium text-gray-600">Customer Satisfaction</p>
                          <div className="flex items-center gap-2">
                            <Progress value={selectedCall.analysis.customer_satisfaction * 20} className="flex-1" />
                            <span className="text-sm font-medium">{selectedCall.analysis.customer_satisfaction}/5</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Key Topics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {selectedCall.analysis.key_topics.map((topic, index) => (
                          <Badge key={index} variant="outline">{topic}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Summary Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Call Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48 w-full">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {selectedCall.summary || 'No summary available for this call.'}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Action Items */}
              {selectedCall.analysis?.action_items && selectedCall.analysis.action_items.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Action Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {selectedCall.analysis.action_items.map((item, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                          <span className="text-sm">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recording Player Modal */}
      <Dialog open={recordingModalOpen} onOpenChange={onCloseRecording}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Call Recording
            </DialogTitle>
            <DialogDescription>
              Audio recording for call {selectedCall?.call_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedCall?.recording_url && (
            <div className="space-y-6">
              {/* Audio Element */}
              <audio
                ref={audioRef}
                src={selectedCall.recording_url}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                preload="metadata"
              />

              {/* Player Controls */}
              <div className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="range"
                      min={0}
                      max={duration}
                      step={1}
                      value={currentTime}
                      onChange={(e) => handleSeek([parseInt(e.target.value)])}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #e5e7eb ${(currentTime / duration) * 100}%, #e5e7eb 100%)`
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(duration)}</span>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex items-center justify-center gap-4">
                  <Button variant="outline" size="sm" onClick={() => handleSkip(-10)}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button size="lg" onClick={handlePlayPause}>
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleSkip(10)}>
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>

                {/* Volume Control */}
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={toggleMute}>
                    {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </Button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange([parseInt(e.target.value)])}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(isMuted ? 0 : volume)}%, #e5e7eb ${(isMuted ? 0 : volume)}%, #e5e7eb 100%)`
                    }}
                  />
                  <span className="text-sm text-gray-500 w-8">{isMuted ? 0 : volume}%</span>
                </div>
              </div>

              {/* Recording Info */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Recording Duration:</span> {formatDuration(selectedCall.recording_duration || 0)}
                  </div>
                  <div>
                    <span className="font-medium">File Size:</span> ~{Math.round((selectedCall.recording_duration || 0) * 0.5)} MB
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Call Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={onCloseDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Details
            </DialogTitle>
            <DialogDescription>
              Complete call metadata and technical information for {selectedCall?.call_id}
            </DialogDescription>
          </DialogHeader>

          {selectedCall && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Basic Call Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Call Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Call ID</p>
                        <p className="font-mono text-sm">{selectedCall.call_id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Twilio SID</p>
                        <p className="font-mono text-sm">{selectedCall.call_sid}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Direction</p>
                        <Badge variant="outline" className="capitalize">{selectedCall.direction}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Status</p>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(selectedCall.status)}
                          <span className="capitalize">{selectedCall.status.replace('-', ' ')}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">From Number</p>
                        <p className="font-medium">{formatPhoneNumber(selectedCall.from_number)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">To Number</p>
                        <p className="font-medium">{formatPhoneNumber(selectedCall.to_number)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Start Time</p>
                        <p>{new Date(selectedCall.start_time).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">End Time</p>
                        <p>{selectedCall.end_time ? new Date(selectedCall.end_time).toLocaleString() : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Duration</p>
                        <p className="font-medium">{formatDuration(selectedCall.duration)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Cost</p>
                        <p className="font-medium">${selectedCall.cost.toFixed(4)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Workflow Information */}
                {selectedCall.workflow_name && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Workflow Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Workflow Name</p>
                          <Badge variant="outline">{selectedCall.workflow_name}</Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Workflow ID</p>
                          <p className="font-mono text-sm">{selectedCall.workflow_id}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Caller Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Caller Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Caller ID</p>
                        <p>{selectedCall.metadata.caller_id || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Caller Name</p>
                        <p>{selectedCall.metadata.caller_name || 'Unknown'}</p>
                      </div>
                      {selectedCall.metadata.geographic_location && (
                        <>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Location</p>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4 text-gray-400" />
                              <span>
                                {[
                                  selectedCall.metadata.geographic_location.city,
                                  selectedCall.metadata.geographic_location.state,
                                  selectedCall.metadata.geographic_location.country
                                ].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Timezone</p>
                            <p>{selectedCall.metadata.geographic_location.timezone || 'Unknown'}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Technical Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Technical Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Network Quality</p>
                        <Badge variant="outline" className={getQualityColor(selectedCall.metadata.network_quality)}>
                          <Wifi className="h-3 w-3 mr-1" />
                          {selectedCall.metadata.network_quality || 'Unknown'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Quality Score</p>
                        <div className="flex items-center gap-2">
                          <Progress value={(selectedCall.metadata.quality_score || 0) * 20} className="flex-1" />
                          <span className="text-sm font-medium">{selectedCall.metadata.quality_score || 0}/5</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Hangup Cause</p>
                        <p>{selectedCall.metadata.hangup_cause || 'Normal'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Forwarded From</p>
                        <p>{selectedCall.metadata.forwarded_from || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Call Path */}
                {selectedCall.metadata.call_path && selectedCall.metadata.call_path.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Call Path</CardTitle>
                      <CardDescription>Route taken by the call through the system</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedCall.metadata.call_path.map((step, index) => (
                          <div key={index} className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </div>
                            <span className="text-sm">{step}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recording Information */}
                {selectedCall.recording_url && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recording Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Recording Available</p>
                          <Badge variant="default">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Yes
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Recording Duration</p>
                          <p className="font-medium">{formatDuration(selectedCall.recording_duration || 0)}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Transcription Available</p>
                          <Badge variant={selectedCall.transcription ? 'default' : 'outline'}>
                            {selectedCall.transcription ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Yes
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                No
                              </>
                            )}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">Summary Available</p>
                          <Badge variant={selectedCall.summary ? 'default' : 'outline'}>
                            {selectedCall.summary ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Yes
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                No
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CallLogModals;
