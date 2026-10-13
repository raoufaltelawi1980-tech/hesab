import { Home, Utensils, Car, HeartPulse, Users, Sparkles, Plane, Wallet, ShoppingBag, Package, Briefcase, Megaphone, Building2, Landmark, Receipt } from 'lucide-react';
export const categoryIconMap = {
  home: Home, utensils: Utensils, car: Car, 'heart-pulse': HeartPulse, users: Users, sparkles: Sparkles, plane: Plane, wallet: Wallet, 'shopping-bag': ShoppingBag, package: Package, briefcase: Briefcase, megaphone: Megaphone, building: Building2, landmark: Landmark, receipt: Receipt,
} as const;
export type CategoryIconKey = keyof typeof categoryIconMap;
