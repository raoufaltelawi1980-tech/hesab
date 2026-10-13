import { IsString } from 'class-validator';

export class ReverseEntryDto {
  @IsString()
  reason!: string;
}
