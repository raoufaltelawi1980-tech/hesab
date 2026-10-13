import {
  Body,
  Controller,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { VOICE_HARD_MAX_BYTES } from './voice.constants.js';
import { VoiceService, type UploadedAudioFile } from './voice.service.js';
import { ParseVoiceDto } from './dto/parse-voice.dto.js';
import { ConfirmVoiceCardDto } from './dto/confirm-voice-card.dto.js';

@Controller('ledgers/:ledgerId/voice')
@UseGuards(AuthGuard)
export class VoiceController {
  constructor(private readonly svc: VoiceService) {}

  /** الرفع متعدد الأجزاء؛ الحدّ الصلب يحمي الذاكرة، والخدمة تفرض الحدّ المنطقي. */
  @Post('transcribe')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: VOICE_HARD_MAX_BYTES } }))
  transcribe(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @UploadedFile() file: UploadedAudioFile | undefined,
    @Body() body: { language?: string },
  ) {
    return this.svc.transcribe(ledgerId, user.id, file, body?.language);
  }

  @Post('parse')
  parse(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ParseVoiceDto,
  ) {
    return this.svc.parse(ledgerId, user.id, dto);
  }

  @Post('confirm')
  confirm(
    @Param('ledgerId') ledgerId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ConfirmVoiceCardDto,
  ) {
    return this.svc.confirm(ledgerId, user.id, dto);
  }
}
