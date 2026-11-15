export type PickupCountyGeography = {
  stateFips: string;
  countyFips: string;
};

export type LoadOperatingArea = {
  areaId: string;
  mappingRevision: string;
};

const MAPPING_REVISION = 'd-515-initial-v1';
const LOS_ANGELES_CSA_COUNTIES = new Set(['037', '059', '065', '071', '111']);

const stateAreas = new Map<string, string>([
  ['02', 'pacific'],
  ['04', 'mountain'],
  ['05', 'west_south_central'],
  ['01', 'east_south_central'],
  ['06', 'pacific'],
  ['08', 'mountain'],
  ['09', 'new_england'],
  ['10', 'south_atlantic'],
  ['11', 'south_atlantic'],
  ['12', 'south_atlantic'],
  ['13', 'south_atlantic'],
  ['15', 'pacific'],
  ['16', 'mountain'],
  ['17', 'east_north_central'],
  ['18', 'east_north_central'],
  ['19', 'west_north_central'],
  ['20', 'west_north_central'],
  ['21', 'east_south_central'],
  ['22', 'west_south_central'],
  ['23', 'new_england'],
  ['24', 'south_atlantic'],
  ['25', 'new_england'],
  ['26', 'east_north_central'],
  ['27', 'west_north_central'],
  ['28', 'east_south_central'],
  ['29', 'west_north_central'],
  ['30', 'mountain'],
  ['31', 'west_north_central'],
  ['32', 'mountain'],
  ['33', 'new_england'],
  ['34', 'middle_atlantic'],
  ['35', 'mountain'],
  ['36', 'middle_atlantic'],
  ['37', 'south_atlantic'],
  ['38', 'west_north_central'],
  ['39', 'east_north_central'],
  ['40', 'west_south_central'],
  ['41', 'pacific'],
  ['42', 'middle_atlantic'],
  ['44', 'new_england'],
  ['45', 'south_atlantic'],
  ['46', 'west_north_central'],
  ['47', 'east_south_central'],
  ['48', 'west_south_central'],
  ['49', 'mountain'],
  ['50', 'new_england'],
  ['51', 'south_atlantic'],
  ['53', 'pacific'],
  ['54', 'south_atlantic'],
  ['55', 'east_north_central'],
  ['56', 'mountain'],
]);

export function deriveLoadOperatingArea(
  geography: PickupCountyGeography
): LoadOperatingArea | null {
  if (!/^\d{2}$/.test(geography.stateFips) || !/^\d{3}$/.test(geography.countyFips)) {
    return null;
  }

  if (geography.stateFips === '06' && LOS_ANGELES_CSA_COUNTIES.has(geography.countyFips)) {
    return { areaId: 'la', mappingRevision: MAPPING_REVISION };
  }

  const areaId = stateAreas.get(geography.stateFips);
  return areaId ? { areaId, mappingRevision: MAPPING_REVISION } : null;
}
