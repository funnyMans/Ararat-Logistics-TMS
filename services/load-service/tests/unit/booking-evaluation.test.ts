import { describe, expect, it } from 'vitest';
import { evaluateBookingSubmission } from '../../src/domain/booking/booking-evaluation';

const customerId = '018f47a2-7b3c-7abc-8def-123456789abc';
const customerFacts = {
  [customerId]: {
    result: 'FOUND' as const,
    status: 'ACTIVE' as const,
    legalName: 'Customer One',
    ownerRevision: 1,
    registrySequence: 4,
  },
};

function validRow() {
  return {
    customerId,
    customerRate: { amount: ' 0001250.5 ', currency: ' usd ' },
    equipmentProfile: 'dry_van',
    totalGrossWeight: { value: ' 12000.5 ', unit: 'lb' },
    stops: [
      {
        type: 'pickup',
        address: {
          addressLine1: '  100 Test Street ',
          addressLine2: ' Suite 2 ',
          city: 'Los Angeles',
          stateCode: 'ca',
          postalCode: '90001',
          coordinates: { latitude: 34.05, longitude: -118.25 },
        },
        appointmentWindow: {
          startAt: '2026-10-20T08:00:00-07:00',
          endAt: '2026-10-20T10:00:00-07:00',
          timeZone: 'America/Los_Angeles',
        },
      },
      {
        type: 'delivery',
        address: {
          addressLine1: '200 Sample Avenue',
          city: 'Phoenix',
          stateCode: 'az',
          postalCode: '85001',
        },
        appointmentWindow: {
          startAt: '2026-10-21T08:00:00-07:00',
          endAt: '2026-10-21T10:00:00-07:00',
          timeZone: 'America/Phoenix',
        },
      },
    ],
    freightLines: [
      {
        description: '  Machine parts  ',
        quantity: ' 00012 ',
        handlingUnitCode: 'pallet',
        stackable: true,
        dimensions: { length: '48', width: '40.0', height: '36.00', unit: 'in' },
      },
    ],
  };
}

describe('evaluateBookingSubmission', () => {
  it('normalizes booking-critical facts and validates timestamp offsets against IANA zones', () => {
    const row = validRow();
    Object.assign(row.stops[0]!.address, { countryCode: null });
    const result = evaluateBookingSubmission([row], customerFacts);

    expect(result.issues).toEqual([]);
    expect(result.normalizedRows[0]).toMatchObject({
      customerRateAmount: '1250.50',
      equipmentProfile: 'DRY_VAN',
      totalGrossWeightValue: '12000.500',
      totalGrossWeightUnit: 'LB',
      stops: [
        {
          stopType: 'PICKUP',
          addressLine1: '100 Test Street',
          addressLine2: 'Suite 2',
          countryCode: 'US',
          stateCode: 'CA',
          appointmentStartAt: '2026-10-20T15:00:00Z',
        },
        { stopType: 'DELIVERY', appointmentStartAt: '2026-10-21T15:00:00Z' },
      ],
      freightLines: [
        {
          description: 'Machine parts',
          quantity: '12',
          handlingUnitCode: 'PALLET',
          length: '48.00',
          width: '40.00',
          height: '36.00',
          dimensionUnit: 'IN',
        },
      ],
    });
  });

  it('rejects offset mismatches at the exact timestamp field', () => {
    const row = validRow();
    row.stops[0]!.appointmentWindow.startAt = '2026-10-20T08:00:00-08:00';

    const result = evaluateBookingSubmission([row], customerFacts);

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        fieldPath: '/rows/0/stops/0/appointmentWindow/startAt',
        code: 'STOP_TIME_ZONE_OFFSET_MISMATCH',
      })
    );
    expect(result.normalizedRows[0]).toBeNull();
  });

  it('keeps invalid planning facts as sorted accepted-booking follow-ups', () => {
    const row = validRow();
    Object.assign(row, {
      customerReference: 'x'.repeat(101),
      equipmentProfile: 'TANKER',
      totalGrossWeight: { value: '-1', unit: 'LB' },
      specialHandlingCodes: ['hazmat', 'not-a-code'],
    });
    row.stops[0]!.address.coordinates = { latitude: 91, longitude: -118 };
    row.stops[0]!.contactPhone = 'call me';
    row.freightLines[0]!.stackable = false;
    row.freightLines[0]!.dimensions = { length: '-1', width: '40', height: '36', unit: 'in' };

    const result = evaluateBookingSubmission([row], customerFacts);

    expect(result.issues).toEqual([]);
    expect(result.normalizedRows[0]).toMatchObject({
      customerReference: null,
      equipmentProfile: 'TANKER',
      totalGrossWeightValue: null,
      freightLines: [{ length: null, width: null, height: null }],
      specialHandlingCodes: ['HAZMAT'],
    });
    expect(result.normalizedRows[0]!.stops[0]).toMatchObject({
      latitude: null,
      longitude: null,
      contactPhone: null,
    });
    expect(result.followUpItems.map(({ code }) => code)).toEqual([
      'CUSTOMER_REFERENCE_TOO_LONG',
      'EQUIPMENT_PROFILE_UNSUPPORTED',
      'FREIGHT_LINE_DIMENSIONS_INVALID_OPTIONAL',
      'SPECIAL_HANDLING_UNSUPPORTED',
      'SPECIAL_HANDLING_CODE_INVALID',
      'STOP_COORDINATES_INVALID',
      'STOP_CONTACT_PHONE_INVALID',
      'TOTAL_GROSS_WEIGHT_INVALID',
    ]);
  });

  it('defaults reefer mode and reports required reefer planning facts', () => {
    const row = validRow();
    Object.assign(row, { equipmentProfile: ' reefer ', totalGrossWeight: null });
    delete (row as Record<string, unknown>).totalGrossWeight;

    const result = evaluateBookingSubmission([row], customerFacts);

    expect(result.issues).toEqual([]);
    expect(result.normalizedRows[0]).toMatchObject({
      equipmentProfile: 'REEFER',
      reeferMode: 'CONTINUOUS',
    });
    expect(result.followUpItems.map(({ code }) => code)).toContain('REEFER_TEMPERATURE_REQUIRED');
    expect(result.followUpItems.map(({ code }) => code)).toContain('REEFER_MODE_DEFAULTED');
    expect(result.followUpItems.map(({ code }) => code)).toContain('TOTAL_GROSS_WEIGHT_REQUIRED');
  });

  it('rejects booking-critical errors in stable row and path order', () => {
    const row = validRow();
    row.customerRate.amount = '0';
    row.stops[0]!.address.postalCode = 'not-a-zip';
    row.freightLines[0]!.quantity = '0';

    const result = evaluateBookingSubmission([row], customerFacts);

    expect(result.issues.map(({ fieldPath, code }) => [fieldPath, code])).toEqual([
      ['/rows/0/customerRate/amount', 'CUSTOMER_RATE_AMOUNT_INVALID'],
      ['/rows/0/freightLines/0/quantity', 'FREIGHT_QUANTITY_INVALID'],
      ['/rows/0/stops/0/address/postalCode', 'STOP_POSTAL_CODE_INVALID'],
    ]);
    expect(result.followUpItems).toEqual([]);
  });

  it('distinguishes invalid ISO currencies from valid but unsupported currencies', () => {
    const invalidCurrencyRow = validRow();
    invalidCurrencyRow.customerRate.currency = 'ZZZ';
    const unsupportedCurrencyRow = validRow();
    unsupportedCurrencyRow.customerRate.currency = 'EUR';

    expect(
      evaluateBookingSubmission([invalidCurrencyRow], customerFacts).issues.map(({ code }) => code)
    ).toContain('CUSTOMER_CURRENCY_INVALID');
    expect(
      evaluateBookingSubmission([unsupportedCurrencyRow], customerFacts).issues.map(
        ({ code }) => code
      )
    ).toContain('CUSTOMER_CURRENCY_UNSUPPORTED');
  });

  it('reports a missing Customer rate object without duplicating child-field errors', () => {
    const row = validRow();
    delete (row as Record<string, unknown>).customerRate;

    const result = evaluateBookingSubmission([row], customerFacts);

    expect(
      result.issues
        .filter(({ fieldPath }) => fieldPath.startsWith('/rows/0/customerRate'))
        .map(({ code }) => code)
    ).toEqual(['CUSTOMER_RATE_REQUIRED']);
  });
});
