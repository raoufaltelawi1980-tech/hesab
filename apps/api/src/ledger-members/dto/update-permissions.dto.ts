import type { Permission } from '@prisma/client';

export class UpdatePermissionsDto {
  permissions!: Permission[];
}