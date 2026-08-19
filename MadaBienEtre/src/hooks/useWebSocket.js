// src/hooks/useWebSocket.js
import { useState, useEffect, useRef, useCallback } from 'react';
import websocketService from '../services/websocketService';

export const useWebSocket = (url, options = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  const listenersRef = useRef([]);

  useEffect(() => {
    const onOpen = () => {
      setIsConnected(true);
      setError(null);
    };

    const onClose = () => {
      setIsConnected(false);
    };

    const onError = (err) => {
      setError(err);
    };

    const onMessage = (data) => {
      setLastMessage(data);
    };

    websocketService.connect(url, {
      token: options.token,
      onOpen,
      onClose,
      onError,
    });

    websocketService.on('message', onMessage);
    websocketService.on('connected', onOpen);
    websocketService.on('disconnected', onClose);
    websocketService.on('error', onError);

    return () => {
      websocketService.off('message', onMessage);
      websocketService.off('connected', onOpen);
      websocketService.off('disconnected', onClose);
      websocketService.off('error', onError);
      websocketService.disconnect();
    };
  }, [url]);

  const send = useCallback((data) => {
    return websocketService.send(data);
  }, []);

  const on = useCallback((event, callback) => {
    websocketService.on(event, callback);
    listenersRef.current.push({ event, callback });
  }, []);

  const off = useCallback((event, callback) => {
    websocketService.off(event, callback);
    listenersRef.current = listenersRef.current.filter(
      (l) => l.event !== event || l.callback !== callback
    );
  }, []);

  const getStatus = useCallback(() => {
    return websocketService.getStatus();
  }, []);

  return {
    isConnected,
    lastMessage,
    error,
    send,
    on,
    off,
    getStatus,
  };
};

export default useWebSocket;