import { describe, expect, it } from 'vitest';
import { deriveLoadOperatingArea } from '../../src/domain/authorization/load-operating-area';

describe('D-515 Load operating-area classification', () => {
  it.each(['037', '059', '065', '071', '111'])(
    'classifies California county FIPS %s into the Los Angeles CSA leaf',
    (countyFips) => {
      expect(deriveLoadOperatingArea({ stateFips: '06', countyFips })).toEqual({
        areaId: 'la',
        mappingRevision: 'd-515-initial-v1',
      });
    }
  );

  it('classifies the remainder of California into Pacific', () => {
    expect(deriveLoadOperatingArea({ stateFips: '06', countyFips: '001' })).toEqual({
      areaId: 'pacific',
      mappingRevision: 'd-515-initial-v1',
    });
  });

  it.each([
    ['04', 'mountain'],
    ['19', 'west_north_central'],
    ['17', 'east_north_central'],
    ['22', 'west_south_central'],
    ['01', 'east_south_central'],
    ['09', 'new_england'],
    ['34', 'middle_atlantic'],
    ['11', 'south_atlantic'],
  ])('classifies state FIPS %s as %s', (stateFips, areaId) => {
    expect(deriveLoadOperatingArea({ stateFips, countyFips: '001' })).toEqual({
      areaId,
      mappingRevision: 'd-515-initial-v1',
    });
  });

  it.each([
    { stateFips: '6', countyFips: '037' },
    { stateFips: '06', countyFips: '37' },
    { stateFips: '72', countyFips: '001' },
  ])('fails closed for unsupported or malformed FIPS values', (geography) => {
    expect(deriveLoadOperatingArea(geography)).toBeNull();
  });
});
