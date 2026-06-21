import { Injectable } from '@nestjs/common';

export interface AuthenticatedClient {
  clientId: string;
}

const configuredClients = [
  { clientId: 'client_a', tokenEnv: 'CLIENT_A_TOKEN', secretEnv: 'CLIENT_A_SECRET' },
  { clientId: 'client_b', tokenEnv: 'CLIENT_B_TOKEN', secretEnv: 'CLIENT_B_SECRET' }
] as const;

@Injectable()
export class AuthService {
  private readonly tokenToClient = new Map<string, string>();
  private readonly clientSecrets = new Map<string, string>();

  constructor() {
    for (const client of configuredClients) {
      this.loadClient(client.clientId, process.env[client.tokenEnv], process.env[client.secretEnv]);
    }
  }

  authenticate(authorization: string | undefined): AuthenticatedClient | null {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.slice('Bearer '.length).trim();
    const clientId = this.tokenToClient.get(token);

    return clientId ? { clientId } : null;
  }

  getSecret(clientId: string): string | null {
    return this.clientSecrets.get(clientId) ?? null;
  }

  private loadClient(clientId: string, token: string | undefined, secret: string | undefined): void {
    if (token) {
      this.tokenToClient.set(token, clientId);
    }

    if (secret) {
      this.clientSecrets.set(clientId, secret);
    }
  }
}
