import * as Location from 'expo-location';

import { LocationIntegrity } from '../../modules/location-integrity';
import { deviceCheckProblem, readSelfMarkLocation, SelfMarkLocationError } from '../utils/selfMarkLocation';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../../modules/location-integrity', () => ({
  LocationIntegrity: { getDeviceChecks: jest.fn() },
}));

const clean = { developerOptionsEnabled: false, rooted: false, appCloned: false };
const getDeviceChecks = LocationIntegrity!.getDeviceChecks as jest.Mock;
const getCurrentPositionAsync = Location.getCurrentPositionAsync as jest.Mock;

function position(mocked: boolean | undefined) {
  return { coords: { latitude: 26.9, longitude: 75.8, accuracy: 12 }, timestamp: 1000, mocked };
}

beforeEach(() => {
  jest.clearAllMocks();
  getDeviceChecks.mockReturnValue(clean);
  getCurrentPositionAsync.mockResolvedValue(position(false));
});

describe('deviceCheckProblem', () => {
  it('passes a clean phone', () => {
    expect(deviceCheckProblem(clean)).toBeNull();
  });

  it.each([
    ['developerOptionsEnabled', /Developer options/],
    ['rooted', /rooted/],
    ['appCloned', /cloner app/],
  ])('refuses %s', (flag, message) => {
    expect(deviceCheckProblem({ ...clean, [flag]: true })).toMatch(message);
  });

  it('refuses an app build without the native checks', () => {
    expect(deviceCheckProblem(null)).toMatch(/Update Smart Gurukul/);
  });
});

describe('readSelfMarkLocation', () => {
  it('sends the fix with the device checks', async () => {
    await expect(readSelfMarkLocation()).resolves.toEqual({
      latitude: 26.9,
      longitude: 75.8,
      accuracy: 12,
      mocked: false,
      fixTimestamp: 1000,
      deviceChecks: clean,
    });
  });

  it('never reads the location when a fake GPS app could be active', async () => {
    getDeviceChecks.mockReturnValue({ ...clean, developerOptionsEnabled: true });
    await expect(readSelfMarkLocation()).rejects.toBeInstanceOf(SelfMarkLocationError);
    expect(getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('refuses a fix the OS marks as mocked', async () => {
    getCurrentPositionAsync.mockResolvedValue(position(true));
    await expect(readSelfMarkLocation()).rejects.toThrow(/fake \(mock\) location/);
  });
});
