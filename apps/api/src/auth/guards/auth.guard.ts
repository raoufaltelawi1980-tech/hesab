import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { createHash } from 'crypto';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: { id: string; email: string } }>();
    const authHeader = request.headers['authorization'];
    if (!authHeader) throw new UnauthorizedException('Unauthorized');
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Unauthorized');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await this.prisma.userSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, status: true } } },
    });
    if (!session || session.user.status !== 'ACTIVE') throw new UnauthorizedException('Unauthorized');
    request.user = { id: session.user.id, email: session.user.email };
    return true;
  }
}
