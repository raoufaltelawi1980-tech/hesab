import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { VOICE_LANGUAGES, type VoiceLanguage } from '../voice.constants.js';

export class ParseVoiceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @IsOptional()
  @IsIn(VOICE_LANGUAGES)
  language?: VoiceLanguage;
}
