import { Module } from '@nestjs/common';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { VoiceController } from './voice.controller.js';
import { VoiceService } from './voice.service.js';
import {
  EnvTranscriptionProvider,
  TRANSCRIPTION_PROVIDER,
} from './transcription.provider.js';

@Module({
  imports: [TransactionsModule],
  controllers: [VoiceController],
  providers: [
    VoiceService,
    { provide: TRANSCRIPTION_PROVIDER, useClass: EnvTranscriptionProvider },
  ],
})
export class VoiceModule {}
