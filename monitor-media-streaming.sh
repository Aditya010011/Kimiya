#!/bin/bash

# Media Streaming Performance Monitor
# Monitors nginx performance, WebSocket connections, and media streaming metrics

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="/var/log/nginx/access.log"
ERROR_LOG="/var/log/nginx/error.log"
BACKEND_URL="http://localhost:3001"

echo -e "${BLUE}🎬 Media Streaming Performance Monitor${NC}"
echo "========================================"

# Function to check nginx status
check_nginx_status() {
    echo -e "\n${YELLOW}📊 Nginx Status${NC}"
    if systemctl is-active --quiet nginx; then
        echo -e "${GREEN}✅ Nginx is running${NC}"
        
        # Get nginx version and modules
        nginx_version=$(nginx -v 2>&1 | cut -d' ' -f3)
        echo "Version: $nginx_version"
        
        # Check for media streaming modules
        if nginx -V 2>&1 | grep -q "http_mp4_module"; then
            echo -e "${GREEN}✅ MP4 module enabled${NC}"
        else
            echo -e "${YELLOW}⚠️  MP4 module not available${NC}"
        fi
        
        if nginx -V 2>&1 | grep -q "http_flv_module"; then
            echo -e "${GREEN}✅ FLV module enabled${NC}"
        else
            echo -e "${YELLOW}⚠️  FLV module not available${NC}"
        fi
    else
        echo -e "${RED}❌ Nginx is not running${NC}"
        return 1
    fi
}

# Function to check backend status
check_backend_status() {
    echo -e "\n${YELLOW}🔧 Backend Status${NC}"
    if curl -s --connect-timeout 5 "$BACKEND_URL/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend is responding${NC}"
        
        # Get backend response time
        response_time=$(curl -o /dev/null -s -w "%{time_total}" "$BACKEND_URL/health")
        echo "Response time: ${response_time}s"
    else
        echo -e "${RED}❌ Backend is not responding${NC}"
        return 1
    fi
}

# Function to monitor WebSocket connections
monitor_websockets() {
    echo -e "\n${YELLOW}🔌 WebSocket Connections${NC}"
    
    # Count active WebSocket connections
    ws_connections=$(netstat -an | grep :3001 | grep ESTABLISHED | wc -l)
    echo "Active connections to backend: $ws_connections"
    
    # Check for WebSocket upgrade requests in recent logs
    if [ -f "$LOG_FILE" ]; then
        ws_upgrades=$(tail -n 1000 "$LOG_FILE" | grep -c "conversationrelay-ws" || echo "0")
        echo "Recent WebSocket requests: $ws_upgrades"
    fi
}

# Function to analyze nginx performance
analyze_performance() {
    echo -e "\n${YELLOW}⚡ Performance Metrics${NC}"
    
    if [ -f "$LOG_FILE" ]; then
        # Get recent request statistics
        echo "Recent activity (last 1000 requests):"
        
        # Count requests by endpoint
        echo "API requests:"
        tail -n 1000 "$LOG_FILE" | grep "/api/" | awk '{print $7}' | sort | uniq -c | sort -nr | head -5
        
        # Average response times
        echo -e "\nResponse time analysis:"
        tail -n 100 "$LOG_FILE" | awk '{print $(NF-1)}' | grep -E '^[0-9]+\.[0-9]+$' | awk '
        {
            sum += $1
            count++
            if ($1 > max) max = $1
            if (min == 0 || $1 < min) min = $1
        }
        END {
            if (count > 0) {
                printf "Average: %.3fs\n", sum/count
                printf "Min: %.3fs\n", min
                printf "Max: %.3fs\n", max
            }
        }'
        
        # Check for errors
        error_count=$(tail -n 1000 "$LOG_FILE" | grep -c " 5[0-9][0-9] " || echo "0")
        if [ "$error_count" -gt 0 ]; then
            echo -e "${RED}⚠️  Found $error_count server errors in recent logs${NC}"
        else
            echo -e "${GREEN}✅ No server errors in recent logs${NC}"
        fi
    else
        echo "Access log not found at $LOG_FILE"
    fi
}

# Function to check media streaming specific metrics
check_media_streaming() {
    echo -e "\n${YELLOW}🎵 Media Streaming Metrics${NC}"
    
    # Check for media file requests
    if [ -f "$LOG_FILE" ]; then
        media_requests=$(tail -n 1000 "$LOG_FILE" | grep -E "\.(mp3|mp4|wav|ogg|webm|m4a)" | wc -l)
        echo "Recent media file requests: $media_requests"
        
        # Check for range requests (streaming)
        range_requests=$(tail -n 1000 "$LOG_FILE" | grep -c "Range:" || echo "0")
        echo "Range requests (streaming): $range_requests"
        
        # Check WebSocket media streaming
        ws_media=$(tail -n 1000 "$LOG_FILE" | grep -c "conversationrelay-ws" || echo "0")
        echo "WebSocket media connections: $ws_media"
    fi
    
    # Check media directory
    if [ -d "/var/www/media" ]; then
        media_size=$(du -sh /var/www/media 2>/dev/null | cut -f1)
        echo "Media directory size: $media_size"
    fi
}

# Function to show recent errors
show_recent_errors() {
    echo -e "\n${YELLOW}🚨 Recent Errors${NC}"
    
    if [ -f "$ERROR_LOG" ]; then
        recent_errors=$(tail -n 50 "$ERROR_LOG" | grep -v "client disconnected" | tail -n 10)
        if [ -n "$recent_errors" ]; then
            echo "$recent_errors"
        else
            echo -e "${GREEN}✅ No recent errors${NC}"
        fi
    else
        echo "Error log not found at $ERROR_LOG"
    fi
}

# Function to test WebSocket connection
test_websocket() {
    echo -e "\n${YELLOW}🧪 WebSocket Connection Test${NC}"
    
    # Simple WebSocket test using curl (if available)
    if command -v wscat &> /dev/null; then
        echo "Testing WebSocket connection..."
        timeout 5 wscat -c "ws://localhost/api/conversationrelay-ws" --no-check || echo "WebSocket test completed"
    else
        echo "wscat not available. Install with: npm install -g wscat"
    fi
}

# Main execution
main() {
    check_nginx_status
    check_backend_status
    monitor_websockets
    analyze_performance
    check_media_streaming
    show_recent_errors
    
    echo -e "\n${BLUE}📈 Monitoring Complete${NC}"
    echo "========================================"
    echo -e "💡 Tips:"
    echo "  • Run this script regularly to monitor performance"
    echo "  • Check logs: sudo tail -f /var/log/nginx/access.log"
    echo "  • Monitor WebSocket connections: netstat -an | grep :3001"
    echo "  • Test configuration: sudo nginx -t"
}

# Handle command line arguments
case "${1:-}" in
    "websocket"|"ws")
        test_websocket
        ;;
    "errors")
        show_recent_errors
        ;;
    "performance"|"perf")
        analyze_performance
        ;;
    *)
        main
        ;;
esac
