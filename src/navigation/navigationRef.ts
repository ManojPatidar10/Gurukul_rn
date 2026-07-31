import { createNavigationContainerRef } from '@react-navigation/native';

import type { PrincipalStackParamList } from '../types/principal';

/**
 * Lets components mounted outside the navigator tree (IncomingCallOverlay, rendered as a sibling
 * of NavigationContainer in App.tsx so it can overlay any screen) navigate imperatively.
 */
export const navigationRef = createNavigationContainerRef<PrincipalStackParamList>();
