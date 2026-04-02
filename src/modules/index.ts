import { autoModule } from './auto';
import { barberModule } from './barber';
import { clubModule } from './club';

export const APP_MODULES = {
  auto: autoModule,
  barber: barberModule,
  club: clubModule,
} as const;
