import type { Permission } from '@prisma/client';

export class InviteMemberDto {
  email!: string;
  permissions?: Permission[];
}