import { autoModule } from './auto';
import { barberModule } from './barber';
import { clubModule } from './club';
import { esteticaModule } from './estetica';

export const APP_MODULES = {
  auto: autoModule,
  barber: barberModule,
  club: clubModule,
  estetica: esteticaModule,
} as const;
