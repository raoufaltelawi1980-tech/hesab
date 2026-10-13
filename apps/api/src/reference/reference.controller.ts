import { Controller, Get } from '@nestjs/common';
import { ReferenceService } from './reference.service.js';

/**
 * المرجع العام (قسم 6.1): مسارات عامة (بلا `AuthGuard`) للقراءة فقط.
 * لا بادئة `/api/v1` في الواقع الحالي (انظر `API_CONTRACTS.md` §23.1).
 */
@Controller('reference')
export class ReferenceController {
  constructor(private readonly svc: ReferenceService) {}

  @Get('countries')
  countries() {
    return this.svc.listCountries();
  }

  @Get('currencies')
  currencies() {
    return this.svc.listCurrencies();
  }
}
