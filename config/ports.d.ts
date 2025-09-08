/**
 * TypeScript definitions for the centralized port configuration system
 */

export interface PortConfig {
  frontend: {
    dev?: number;
    preview?: number;
    http?: number;
    https?: number;
    alt_http?: number;
  };
  backend: {
    api: number;
    debug: number;
  };
  alternative?: {
    http?: number;
    backend_alt?: number;
  };
}

export interface SystemPorts {
  ssh: number;
  nginx_http: number;
  nginx_https: number;
}

export interface AllPortConfig {
  development: PortConfig;
  staging: PortConfig;
  production: PortConfig;
  system: SystemPorts;
}

export declare const PORT_CONFIG: AllPortConfig;

export declare function getPortConfig(environment?: string): PortConfig;
export declare function getPort(service: string, environment?: string): number;
export declare function getBackendUrl(environment?: string): string;
export declare function getFrontendUrl(environment?: string): string;
export declare function validatePortConfig(environment?: string): boolean;
export declare function displayPortConfig(environment?: string): void;
