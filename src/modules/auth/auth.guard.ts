import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthService, type AuthenticatedClient } from './auth.service';

export interface AuthenticatedRequest extends FastifyRequest {
  client: AuthenticatedClient;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const headers = request.headers as Record<string, string | string[] | undefined>;
    const header = headers.authorization;
    const authorization = Array.isArray(header) ? header[0] : header;
    const authenticated = this.authService.authenticate(authorization);

    if (!authenticated) {
      throw new UnauthorizedException('Invalid bearer token');
    }

    (request as AuthenticatedRequest).client = authenticated;
    return true;
  }
}
