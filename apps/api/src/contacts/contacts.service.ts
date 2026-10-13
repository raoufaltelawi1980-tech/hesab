import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Permission, Prisma, type ContactKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CONTACT_ERROR_CODES } from './contacts.errors.js';
import { SUPPLIER_DB_KIND, type ContactKindInput } from './contacts.constants.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { UpdateContactDto } from './dto/update-contact.dto.js';
import { ListContactsDto } from './dto/list-contacts.dto.js';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+$/;

type LedgerRow = { id: string; ownerId: string; type: string; baseCurrencyId: string };

type ContactRow = {
  id: string;
  ledgerId: string;
  kind: ContactKind;
  name: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
  currencyId: string | null;
  creditLimit: Prisma.Decimal | null;
  notes: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** `Decimal(20,4)` prints with the scale the schema declares. */
function money(value: Prisma.Decimal | null | undefined): string {
  return value === null || value === undefined ? '0.0000' : value.toFixed(4);
}

function parseDecimal(raw: unknown, field: string): Prisma.Decimal {
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    throw new BadRequestException(`${field} مطلوب`);
  }
  const text = String(raw).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new BadRequestException(`${field} ليس رقمًا صالحًا`);
  return new Prisma.Decimal(text);
}

/** A credit limit may be zero, but never negative. */
function nonNegativeDecimal(raw: unknown, field: string): Prisma.Decimal {
  const value = parseDecimal(raw, field);
  if (value.lt(0)) throw new BadRequestException(`${field} يجب أن يكون صفرًا أو أكبر`);
  return value;
}

/** Trims an optional text field: empty becomes `null`, absent stays `undefined`. */
function optionalText(raw: unknown, max: number, field: string): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== 'string') throw new BadRequestException(`${field} غير صالح`);
  const text = raw.trim();
  if (text.length === 0) return null;
  if (text.length > max) throw new BadRequestException(`${field} يجب أن لا يتجاوز ${max} حرفًا`);
  return text;
}

function optionalEmail(raw: unknown): string | null | undefined {
  const text = optionalText(raw, 320, 'email');
  if (text === undefined || text === null) return text;
  if (!EMAIL_RE.test(text)) throw new BadRequestException('email غير صالح');
  return text;
}

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public `SUPPLIER` and the schema's `SUPPLER` both land on the stored enum. */
  private toDbKind(raw: unknown): ContactKind {
    if (raw === 'CUSTOMER') return 'CUSTOMER';
    if (raw === 'SUPPLIER' || raw === SUPPLIER_DB_KIND) return SUPPLIER_DB_KIND;
    throw new BadRequestException('kind غير صالح');
  }

  private toApiKind(kind: ContactKind): ContactKindInput {
    return kind === 'CUSTOMER' ? 'CUSTOMER' : 'SUPPLIER';
  }

  /**
   * One gate for every route: the ledger must exist, the actor must hold the
   * requested permission, and the ledger must be a BUSINESS ledger. Permission
   * is checked before the ledger type so a stranger learns nothing.
   */
  private async gate(ledgerId: string, actorId: string, permission: Permission): Promise<LedgerRow> {
    if (!isUuid(ledgerId)) throw new BadRequestException('معرّف الدفتر غير صالح');
    const ledger = await this.prisma.ledger.findUnique({ where: { id: ledgerId } });
    if (!ledger) throw new BadRequestException('الدفتر غير موجود');
    if (!(await this.can(ledger, actorId, permission))) {
      throw new ForbiddenException('لا تملك صلاحية تنفيذ هذه العملية');
    }
    if (ledger.type !== 'BUSINESS') {
      throw new ForbiddenException(
        `${CONTACT_ERROR_CODES.LEDGER_NOT_BUSINESS}: العملاء والموردون متاحون للدفتر التجاري فقط`,
      );
    }
    return ledger;
  }

  private async can(
    ledger: { id: string; ownerId: string },
    actorId: string,
    permission: Permission,
  ): Promise<boolean> {
    if (ledger.ownerId === actorId) return true;
    const membership = await this.prisma.ledgerMember.findUnique({
      where: { ledgerId_userId: { ledgerId: ledger.id, userId: actorId } },
      include: { permissions: true },
    });
    if (!membership) return false;
    return membership.permissions.some(
      (row: { revokedAt: Date | null; permission: Permission }) =>
        !row.revokedAt && row.permission === permission,
    );
  }

  private async loadContact(ledgerId: string, contactId: string): Promise<ContactRow> {
    if (!isUuid(contactId)) throw new BadRequestException('معرّف جهة الاتصال غير صالح');
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.ledgerId !== ledgerId) throw new BadRequestException('جهة الاتصال غير موجودة');
    return contact;
  }

  private assertNotArchived(contact: ContactRow): void {
    if (contact.archivedAt) {
      throw new BadRequestException(`${CONTACT_ERROR_CODES.ARCHIVED}: لا يمكن التعامل مع جهة اتصال مؤرشفة`);
    }
  }

  private async resolveCurrencyId(ledger: LedgerRow, currencyId: unknown): Promise<string> {
    if (currencyId === undefined || currencyId === null || currencyId === '') return ledger.baseCurrencyId;
    if (!isUuid(currencyId)) throw new BadRequestException('معرّف العملة غير صالح');
    const currency = await this.prisma.currency.findUnique({ where: { id: currencyId } });
    if (!currency) throw new BadRequestException('العملة غير صالحة');
    return currency.id;
  }

  private serialize(contact: ContactRow) {
    return {
      id: contact.id,
      ledgerId: contact.ledgerId,
      kind: this.toApiKind(contact.kind),
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      taxNumber: contact.taxNumber,
      currencyId: contact.currencyId,
      creditLimit: contact.creditLimit === null ? null : money(contact.creditLimit),
      notes: contact.notes,
      archivedAt: contact.archivedAt ? contact.archivedAt.toISOString() : null,
      createdAt: contact.createdAt.toISOString(),
      updatedAt: contact.updatedAt.toISOString(),
    };
  }

  async list(ledgerId: string, actorId: string, query: ListContactsDto = {}) {
    await this.gate(ledgerId, actorId, Permission.CONTACT_VIEW);
    const kind =
      query.kind === undefined || query.kind === null || query.kind === ''
        ? undefined
        : this.toDbKind(query.kind);
    const includeArchived =
      query.includeArchived === true || query.includeArchived === 'true' || query.includeArchived === '1';
    const contacts = await this.prisma.contact.findMany({
      where: { ledgerId, ...(kind ? { kind } : {}), ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: { name: 'asc' },
    });
    return contacts.map((contact: ContactRow) => this.serialize(contact));
  }

  async create(ledgerId: string, actorId: string, dto: CreateContactDto) {
    const ledger = await this.gate(ledgerId, actorId, Permission.CONTACT_MANAGE);
    const name = (dto.name ?? '').trim();
    if (name.length < 1 || name.length > 200) {
      throw new BadRequestException('name يجب أن يكون بين 1 و 200 حرفًا');
    }
    const kind = this.toDbKind(dto.kind);
    const email = optionalEmail(dto.email);
    const phone = optionalText(dto.phone, 40, 'phone');
    const taxNumber = optionalText(dto.taxNumber, 60, 'taxNumber');
    const notes = optionalText(dto.notes, 1000, 'notes');
    const creditLimit =
      dto.creditLimit === undefined || dto.creditLimit === null
        ? null
        : nonNegativeDecimal(dto.creditLimit, 'creditLimit');
    const currencyId = await this.resolveCurrencyId(ledger, dto.currencyId);

    const created = await this.prisma.contact.create({
      data: { ledgerId, kind, name, email, phone, taxNumber, notes, creditLimit, currencyId },
    });
    return this.serialize(created);
  }

  async get(ledgerId: string, contactId: string, actorId: string) {
    await this.gate(ledgerId, actorId, Permission.CONTACT_VIEW);
    return this.serialize(await this.loadContact(ledgerId, contactId));
  }

  async update(ledgerId: string, contactId: string, actorId: string, dto: UpdateContactDto) {
    await this.gate(ledgerId, actorId, Permission.CONTACT_MANAGE);
    const contact = await this.loadContact(ledgerId, contactId);
    this.assertNotArchived(contact);

    const data: Prisma.ContactUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 1 || name.length > 200) {
        throw new BadRequestException('name يجب أن يكون بين 1 و 200 حرفًا');
      }
      data.name = name;
    }
    if (dto.email !== undefined) data.email = optionalEmail(dto.email) ?? null;
    if (dto.phone !== undefined) data.phone = optionalText(dto.phone, 40, 'phone') ?? null;
    if (dto.taxNumber !== undefined) data.taxNumber = optionalText(dto.taxNumber, 60, 'taxNumber') ?? null;
    if (dto.notes !== undefined) data.notes = optionalText(dto.notes, 1000, 'notes') ?? null;
    if (dto.creditLimit !== undefined) {
      data.creditLimit =
        dto.creditLimit === null ? null : nonNegativeDecimal(dto.creditLimit, 'creditLimit');
    }

    const updated = await this.prisma.contact.update({ where: { id: contactId }, data });
    return this.serialize(updated);
  }

  /** `DELETE` archives, it never deletes: a contact may anchor posted entries. */
  async archive(ledgerId: string, contactId: string, actorId: string) {
    await this.gate(ledgerId, actorId, Permission.CONTACT_MANAGE);
    const contact = await this.loadContact(ledgerId, contactId);
    this.assertNotArchived(contact);
    const updated = await this.prisma.contact.update({
      where: { id: contactId },
      data: { archivedAt: new Date() },
    });
    return { message: 'تم أرشفة جهة الاتصال', contact: this.serialize(updated) };
  }
}