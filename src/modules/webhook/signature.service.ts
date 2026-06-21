import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SignatureService {
  verify(rawBody: Buffer, providedSignature: string | undefined, secret: string): boolean {
    if (!providedSignature) {
      return false;
    }

    const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex');
    const normalized = providedSignature.startsWith('sha256=')
      ? providedSignature.slice('sha256='.length)
      : providedSignature;

    const expected = Buffer.from(expectedHex, 'hex');
    const actual = Buffer.from(normalized, 'hex');

    // timingSafeEqual throws when lengths differ, so length is checked first while still avoiding value-dependent comparisons.
    if (actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  }
}
