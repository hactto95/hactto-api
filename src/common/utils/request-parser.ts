import { Request } from 'express';
import { ForbiddenException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import * as crypto from 'crypto';

@Injectable({ scope: Scope.REQUEST })
export class RequestParser {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  getIpOrThrow() {
    let ip =
      (this.request.headers['x-forwarded-for'] as string) ||
      this.request.socket.remoteAddress;

    if (!ip) throw new ForbiddenException('IP 주소를 식별할 수 없습니다.');

    if (ip.includes(',')) ip = ip.split(',')[0].trim();

    ip = ip.replace(/^IP:\s*/i, '');
    ip = ip.replace(/^::ffff:/, '');
    ip = ip.trim();

    return ip;
  }

  getHeaders(path?: string) {
    if (path) return this.request.headers[path];
    return this.request.headers;
  }

  getCookies() {
    const cookieHeader = this.request.headers.cookie;
    if (cookieHeader) {
      return cookieHeader.split(';').reduce((cookies, cookie) => {
        const [name, value] = cookie.trim().split('=');
        cookies[name] = value;
        return cookies;
      }, {});
    }
    return {};
  }

  getUserId() {
    const req = this.request as any;
    if (req.user && req.user.sub) return req.user.sub;
    if (req.user && req.user.id) return req.user.id;

    const authHeader = this.request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const secret =
            process.env.JWT_ACCESS_SECRET || 'fallback-access-secret';
          const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(`${parts[0]}.${parts[1]}`)
            .digest('base64url');
          if (parts[2] !== expectedSignature) {
            return undefined;
          }

          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf8'),
          );
          if (
            typeof payload?.exp === 'number' &&
            payload.exp * 1000 <= Date.now()
          ) {
            return undefined;
          }
          if (payload && (payload.sub || payload.id)) {
            return (payload.sub || payload.id) as string;
          }
        }
      } catch {
        // Ignore malformed token
      }
    }

    const headerId =
      (this.request.headers['x-user-id'] as string) ||
      (this.request.query?.userId as string) ||
      (this.request.body?.userId as string);

    return headerId || undefined;
  }

  getMasterKey() {
    return (
      (this.request.headers['x-master-key'] as string) ||
      (this.request.query?.mk as string) ||
      (this.request.body?.mk as string)
    );
  }
}
