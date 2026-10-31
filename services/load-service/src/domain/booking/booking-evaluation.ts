import type { CustomerBookingFactResult } from '../customer-booking/customer-booking-fact-result';

export type BookingIssue = {
  rowNumber: number;
  fieldPath: string;
  code: string;
  message: string;
  correctiveAction: string;
};

export type BookingFollowUp = {
  rowNumber: number;
  fieldPath: string;
  code: string;
  message: string;
  correctiveAction: string;
  requiredStage: 'PLANNING' | 'EXECUTION_START' | 'DELIVERY_CLOSEOUT' | null;
  blocksStage: boolean;
};

export type NormalizedBookingRow = {
  customerId: string;
  customerNameSnapshot: string;
  customerReference: string | null;
  customerRateAmount: string;
  equipmentProfile: string | null;
  totalGrossWeightValue: string | null;
  totalGrossWeightUnit: string | null;
  temperatureMinimum: string | null;
  temperatureMaximum: string | null;
  temperatureUnit: string | null;
  reeferMode: string | null;
  tarpRequired: boolean | null;
  stops: Array<{
    stopType: 'PICKUP' | 'DELIVERY';
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    stateCode: string;
    postalCode: string;
    countryCode: 'US';
    latitude: number | null;
    longitude: number | null;
    appointmentStartAt: string;
    appointmentEndAt: string;
    timeZone: string;
    facilityName: string | null;
    contactName: string | null;
    contactPhone: string | null;
    accessInstructions: string | null;
  }>;
  freightLines: Array<{
    description: string;
    quantity: string;
    handlingUnitCode: string;
    handlingUnitDescription: string | null;
    stackable: boolean;
    length: string | null;
    width: string | null;
    height: string | null;
    dimensionUnit: string | null;
  }>;
  specialHandlingCodes: string[];
};

export type BookingEvaluation = {
  normalizedRows: Array<NormalizedBookingRow | null>;
  issues: BookingIssue[];
  followUpItems: BookingFollowUp[];
};

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATE_CODES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(
    ' '
  )
);
const HANDLING_UNIT_CODES = new Set(
  'PALLET SKID CASE CARTON BOX PIECE CRATE DRUM BAG ROLL CONTAINER OTHER'.split(' ')
);
const EQUIPMENT_PROFILES = new Set(['DRY_VAN', 'REEFER', 'FLATBED', 'STEP_DECK', 'TANKER']);
const SUPPORTED_EQUIPMENT_PROFILES = new Set(['DRY_VAN', 'REEFER', 'FLATBED']);
const REJECTION = {
  message: 'The booking contains a value that does not meet the booking requirements.',
  correctiveAction: 'Correct the identified field and submit a new booking attempt.',
};

const ROW_KEYS = new Set([
  'areaId',
  'customerId',
  'customerReference',
  'customerRate',
  'equipmentProfile',
  'specialHandlingCodes',
  'totalGrossWeight',
  'temperatureRange',
  'reeferMode',
  'tarpRequired',
  'stops',
  'freightLines',
]);
const STOP_KEYS = new Set([
  'type',
  'address',
  'appointmentWindow',
  'facilityName',
  'contactName',
  'contactPhone',
  'accessInstructions',
]);
const ADDRESS_KEYS = new Set([
  'addressLine1',
  'addressLine2',
  'city',
  'stateCode',
  'postalCode',
  'countryCode',
  'coordinates',
]);
const WINDOW_KEYS = new Set(['startAt', 'endAt', 'timeZone']);
const COORDINATE_KEYS = new Set(['latitude', 'longitude']);
const FREIGHT_KEYS = new Set([
  'description',
  'quantity',
  'handlingUnitCode',
  'handlingUnitDescription',
  'stackable',
  'dimensions',
]);
const DIMENSION_KEYS = new Set(['length', 'width', 'height', 'unit']);
const WEIGHT_KEYS = new Set(['value', 'unit']);
const TEMPERATURE_KEYS = new Set(['minimum', 'maximum', 'unit']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function trim(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function codePointLength(value: string): number {
  return [...value].length;
}

function issue(
  issues: BookingIssue[],
  rowNumber: number,
  fieldPath: string,
  code: string,
  message = REJECTION.message,
  correctiveAction = REJECTION.correctiveAction
): void {
  issues.push({ rowNumber, fieldPath, code, message, correctiveAction });
}

function followUp(
  followUps: BookingFollowUp[],
  rowNumber: number,
  fieldPath: string,
  code: string,
  requiredStage: BookingFollowUp['requiredStage'],
  blocksStage: boolean,
  message: string,
  correctiveAction: string
): void {
  followUps.push({
    rowNumber,
    fieldPath,
    code,
    requiredStage,
    blocksStage,
    message,
    correctiveAction,
  });
}

function unknownFields(
  value: Record<string, unknown>,
  allowed: Set<string>,
  issues: BookingIssue[],
  rowNumber: number,
  basePath: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issue(
        issues,
        rowNumber,
        `${basePath}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`,
        'UNKNOWN_FIELD',
        'The request contains a field that is not supported.',
        'Remove the unsupported field.'
      );
    }
  }
}

function canonicalDecimal(value: string, scale: number, maxWholeDigits: number): string | null {
  const expression = new RegExp(`^(\\d+)(?:\\.(\\d{1,${scale}}))?$`);
  const match = expression.exec(value.trim());
  if (!match) {
    return null;
  }
  const whole = match[1]!.replace(/^0+(?=\d)/, '');
  if (whole.length > maxWholeDigits || (/^0+$/.test(whole) && !match[2])) {
    return null;
  }
  const fraction = (match[2] ?? '').padEnd(scale, '0');
  const result = `${whole}.${fraction}`;
  if (BigInt(whole) === 0n && BigInt(fraction || '0') === 0n) {
    return null;
  }
  return result;
}

function canonicalSignedDecimal(
  value: string,
  scale: number,
  maxWholeDigits: number
): string | null {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match || (match[3]?.length ?? 0) > scale) {
    return null;
  }
  const whole = match[2]!.replace(/^0+(?=\d)/, '');
  if (whole.length > maxWholeDigits) {
    return null;
  }
  const fraction = (match[3] ?? '').padEnd(scale, '0');
  const isZero = BigInt(whole) === 0n && BigInt(fraction || '0') === 0n;
  return `${match[1] === '-' && !isZero ? '-' : ''}${whole}.${fraction}`;
}

function formatCoordinate(value: unknown, min: number, max: number): number | null {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    Math.abs(value * 1_000_000 - Math.round(value * 1_000_000)) > 1e-8
  ) {
    return null;
  }
  return value;
}

function offsetAt(timeZone: string, instant: Date): number | null {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const local = new Date(0);
  local.setUTCFullYear(Number(values.year), Number(values.month) - 1, Number(values.day));
  local.setUTCHours(Number(values.hour), Number(values.minute), Number(values.second), 0);
  const localAsUtc = local.getTime();
  const utcSecond = Math.floor(instant.getTime() / 1000) * 1000;
  return (localAsUtc - utcSecond) / 60_000;
}

type ParsedTimestamp = { utc: string; instant: Date; offsetMinutes: number };

function parseTimestamp(value: unknown): ParsedTimestamp | null {
  const source = trim(value);
  const match =
    source &&
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/.exec(source);
  if (!match) {
    return null;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction, zone] = match;
  const [year, month, day, hour, minute, second] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
  ].map(Number);
  const local = new Date(0);
  local.setUTCFullYear(year!, month! - 1, day!);
  local.setUTCHours(hour!, minute!, second!, 0);
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month! - 1 ||
    local.getUTCDate() !== day ||
    hour! > 23 ||
    minute! > 59 ||
    second! > 59
  ) {
    return null;
  }

  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const offsetMatch = /^([+-])(\d{2}):(\d{2})$/.exec(zone!);
    if (!offsetMatch) {
      return null;
    }
    const offsetHour = Number(offsetMatch[2]);
    const offsetMinute = Number(offsetMatch[3]);
    if (offsetHour > 23 || offsetMinute > 59) {
      return null;
    }
    offsetMinutes = (offsetHour * 60 + offsetMinute) * (offsetMatch[1] === '+' ? 1 : -1);
  }

  const fractionDigits = fraction?.slice(1) ?? '';
  const millisecond = Number(fractionDigits.slice(0, 3).padEnd(3, '0'));
  const instant = new Date(local.getTime() + millisecond - offsetMinutes * 60_000);
  const utcBase = instant.toISOString().slice(0, 19);
  const normalizedFraction = fractionDigits.replace(/0+$/, '');
  return {
    utc: `${utcBase}${normalizedFraction ? `.${normalizedFraction}` : ''}Z`,
    instant,
    offsetMinutes,
  };
}

function validTimeZone(value: unknown): string | null {
  const timeZone = trim(value);
  if (!timeZone) {
    return null;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return timeZone;
  } catch {
    return null;
  }
}

function optionalFollowUpText(
  value: unknown,
  limit: number,
  rowNumber: number,
  path: string,
  followUps: BookingFollowUp[]
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    followUp(
      followUps,
      rowNumber,
      path,
      'STOP_OPTIONAL_FIELD_INVALID',
      null,
      false,
      'An optional stop value was omitted because it is invalid.',
      'Provide text or remove the field.'
    );
    return null;
  }
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }
  if (codePointLength(normalized) > limit) {
    followUp(
      followUps,
      rowNumber,
      path,
      'STOP_OPTIONAL_FIELD_TOO_LONG',
      null,
      false,
      'An optional stop value was omitted because it is too long.',
      `Limit the field to ${limit} Unicode code points.`
    );
    return null;
  }
  return normalized;
}

function normalizeRow(
  value: unknown,
  rowIndex: number,
  customerFacts: Record<string, CustomerBookingFactResult>,
  issues: BookingIssue[],
  followUps: BookingFollowUp[]
): NormalizedBookingRow | null {
  const rowNumber = rowIndex + 1;
  const rowPath = `/rows/${rowIndex}`;
  const initialIssueCount = issues.length;
  if (!isRecord(value)) {
    issue(
      issues,
      rowNumber,
      rowPath,
      'UNKNOWN_FIELD',
      'The Load row must be an object.',
      'Provide a Load row object.'
    );
    return null;
  }
  unknownFields(value, ROW_KEYS, issues, rowNumber, rowPath);

  const customerId = trim(value.customerId)?.toLowerCase();
  if (!customerId) {
    issue(issues, rowNumber, `${rowPath}/customerId`, 'CUSTOMER_ID_REQUIRED');
  } else if (!UUID_V7_PATTERN.test(customerId)) {
    issue(issues, rowNumber, `${rowPath}/customerId`, 'CUSTOMER_ID_INVALID');
  }

  const customerFact =
    customerId && UUID_V7_PATTERN.test(customerId) ? customerFacts[customerId] : undefined;
  let customerNameSnapshot: string | null = null;
  if (customerFact?.result === 'NOT_FOUND') {
    issue(issues, rowNumber, `${rowPath}/customerId`, 'CUSTOMER_NOT_FOUND');
  } else if (customerFact?.result === 'FOUND') {
    if (customerFact.status !== 'ACTIVE') {
      issue(issues, rowNumber, `${rowPath}/customerId`, 'CUSTOMER_NOT_ACTIVE');
    } else {
      customerNameSnapshot = customerFact.legalName;
    }
  } else if (customerId && UUID_V7_PATTERN.test(customerId)) {
    throw new Error(`Customer fact lookup was not provided for "${customerId}".`);
  }

  const rate = isRecord(value.customerRate) ? value.customerRate : null;
  if (!rate) {
    issue(issues, rowNumber, `${rowPath}/customerRate`, 'CUSTOMER_RATE_REQUIRED');
  }
  let customerRateAmount: string | null = null;
  if (rate) {
    unknownFields(
      rate,
      new Set(['amount', 'currency']),
      issues,
      rowNumber,
      `${rowPath}/customerRate`
    );
    const rawRateAmount = trim(rate.amount);
    customerRateAmount = rawRateAmount ? canonicalDecimal(rawRateAmount, 2, 10) : null;
    if (!customerRateAmount) {
      issue(
        issues,
        rowNumber,
        `${rowPath}/customerRate/amount`,
        'CUSTOMER_RATE_AMOUNT_INVALID',
        'The Customer rate amount must be a positive decimal string.',
        'Enter a positive amount using decimal notation.'
      );
    }
    const currency = trim(rate.currency)?.toUpperCase();
    const validCurrencies =
      typeof Intl.supportedValuesOf === 'function'
        ? new Set(Intl.supportedValuesOf('currency'))
        : new Set(['USD']);
    if (!currency || !validCurrencies.has(currency)) {
      issue(issues, rowNumber, `${rowPath}/customerRate/currency`, 'CUSTOMER_CURRENCY_INVALID');
    } else if (currency !== 'USD') {
      issue(
        issues,
        rowNumber,
        `${rowPath}/customerRate/currency`,
        'CUSTOMER_CURRENCY_UNSUPPORTED',
        'Only USD Customer rates are supported.',
        'Provide the Customer rate in USD.'
      );
    }
  }

  const equipmentWasSupplied =
    value.equipmentProfile !== undefined && value.equipmentProfile !== null;
  const rawEquipmentProfile = trim(value.equipmentProfile);
  const equipmentProfile = rawEquipmentProfile?.toUpperCase() ?? null;
  let normalizedEquipmentProfile: string | null = null;
  if (equipmentWasSupplied) {
    if (!equipmentProfile || !EQUIPMENT_PROFILES.has(equipmentProfile)) {
      followUp(
        followUps,
        rowNumber,
        `${rowPath}/equipmentProfile`,
        'EQUIPMENT_PROFILE_INVALID',
        'PLANNING',
        true,
        'The equipment profile is invalid and must be corrected before planning.',
        'Select a supported equipment profile.'
      );
    } else {
      normalizedEquipmentProfile = equipmentProfile;
      if (!SUPPORTED_EQUIPMENT_PROFILES.has(equipmentProfile)) {
        followUp(
          followUps,
          rowNumber,
          `${rowPath}/equipmentProfile`,
          'EQUIPMENT_PROFILE_UNSUPPORTED',
          'PLANNING',
          true,
          'The equipment profile is not yet supported for automated planning.',
          'Select a supported profile or wait until this profile is enabled.'
        );
      }
    }
  } else {
    followUp(
      followUps,
      rowNumber,
      `${rowPath}/equipmentProfile`,
      'EQUIPMENT_PROFILE_REQUIRED',
      'PLANNING',
      true,
      'An equipment profile is required before planning.',
      'Select an equipment profile.'
    );
  }

  let totalGrossWeightValue: string | null = null;
  let totalGrossWeightUnit: string | null = null;
  if (value.totalGrossWeight === undefined || value.totalGrossWeight === null) {
    followUp(
      followUps,
      rowNumber,
      `${rowPath}/totalGrossWeight`,
      'TOTAL_GROSS_WEIGHT_REQUIRED',
      'PLANNING',
      true,
      'Total gross weight is required before planning.',
      'Provide a positive total gross weight and select LB or KG.'
    );
  } else {
    if (isRecord(value.totalGrossWeight)) {
      unknownFields(
        value.totalGrossWeight,
        WEIGHT_KEYS,
        issues,
        rowNumber,
        `${rowPath}/totalGrossWeight`
      );
      const rawValue = trim(value.totalGrossWeight.value);
      const candidate = rawValue ? canonicalDecimal(rawValue, 3, 9) : null;
      const unit = trim(value.totalGrossWeight.unit)?.toUpperCase();
      if (candidate && (unit === 'LB' || unit === 'KG')) {
        totalGrossWeightValue = candidate;
        totalGrossWeightUnit = unit;
      }
    }
    if (!totalGrossWeightValue || !totalGrossWeightUnit) {
      followUp(
        followUps,
        rowNumber,
        `${rowPath}/totalGrossWeight`,
        'TOTAL_GROSS_WEIGHT_INVALID',
        'PLANNING',
        true,
        'The supplied total gross weight was omitted because it is invalid.',
        'Provide a positive weight within the supported range and select LB or KG.'
      );
    }
  }

  const hasTemperature = value.temperatureRange !== undefined && value.temperatureRange !== null;
  const hasReeferMode = value.reeferMode !== undefined && value.reeferMode !== null;
  if (
    normalizedEquipmentProfile &&
    normalizedEquipmentProfile !== 'REEFER' &&
    (hasTemperature || hasReeferMode)
  ) {
    if (hasTemperature) {
      issue(issues, rowNumber, `${rowPath}/temperatureRange`, 'REEFER_REQUIREMENT_NOT_APPLICABLE');
    }
    if (hasReeferMode) {
      issue(issues, rowNumber, `${rowPath}/reeferMode`, 'REEFER_REQUIREMENT_NOT_APPLICABLE');
    }
  }

  let temperatureMinimum: string | null = null;
  let temperatureMaximum: string | null = null;
  let temperatureUnit: string | null = null;
  if (hasTemperature) {
    if (isRecord(value.temperatureRange)) {
      unknownFields(
        value.temperatureRange,
        TEMPERATURE_KEYS,
        issues,
        rowNumber,
        `${rowPath}/temperatureRange`
      );
      const minText = trim(value.temperatureRange.minimum);
      const maxText = trim(value.temperatureRange.maximum);
      const minimum = minText ? canonicalSignedDecimal(minText, 2, 3) : null;
      const maximum = maxText ? canonicalSignedDecimal(maxText, 2, 3) : null;
      const unit = trim(value.temperatureRange.unit)?.toUpperCase() ?? null;
      if (
        minimum &&
        maximum &&
        Number(minimum) <= Number(maximum) &&
        (unit === 'F' || unit === 'C')
      ) {
        temperatureMinimum = minimum;
        temperatureMaximum = maximum;
        temperatureUnit = unit;
      }
    }
    if (!temperatureMinimum || !temperatureMaximum || !temperatureUnit) {
      if (!normalizedEquipmentProfile || normalizedEquipmentProfile === 'REEFER') {
        followUp(
          followUps,
          rowNumber,
          `${rowPath}/temperatureRange`,
          'REEFER_TEMPERATURE_RANGE_INVALID',
          'PLANNING',
          true,
          'The supplied reefer temperature range was omitted because it is invalid.',
          'Provide valid minimum and maximum temperatures and select F or C.'
        );
      }
    }
  } else if (normalizedEquipmentProfile === 'REEFER') {
    followUp(
      followUps,
      rowNumber,
      `${rowPath}/temperatureRange`,
      'REEFER_TEMPERATURE_REQUIRED',
      'PLANNING',
      true,
      'A temperature range is required before planning a reefer Load.',
      'Provide minimum and maximum temperatures and select F or C.'
    );
  }

  let reeferMode: string | null = null;
  if (hasReeferMode) {
    const requestedMode = trim(value.reeferMode)?.toUpperCase();
    if (requestedMode === 'CONTINUOUS' || requestedMode === 'START_STOP') {
      reeferMode = requestedMode;
    } else if (normalizedEquipmentProfile === 'REEFER') {
      reeferMode = 'CONTINUOUS';
      followUp(
        followUps,
        rowNumber,
        `${rowPath}/reeferMode`,
        'REEFER_MODE_INVALID',
        null,
        false,
        'The invalid reefer mode was omitted and CONTINUOUS was selected.',
        'Confirm the default or provide CONTINUOUS or START_STOP.'
      );
    }
  } else if (normalizedEquipmentProfile === 'REEFER') {
    reeferMode = 'CONTINUOUS';
    followUp(
      followUps,
      rowNumber,
      `${rowPath}/reeferMode`,
      'REEFER_MODE_DEFAULTED',
      null,
      false,
      'CONTINUOUS was selected as the default reefer mode.',
      'Confirm the default or select START_STOP.'
    );
  }

  let tarpRequired: boolean | null = null;
  if (normalizedEquipmentProfile === 'FLATBED') {
    if (typeof value.tarpRequired === 'boolean') {
      tarpRequired = value.tarpRequired;
    } else {
      followUp(
        followUps,
        rowNumber,
        `${rowPath}/tarpRequired`,
        value.tarpRequired === undefined || value.tarpRequired === null
          ? 'FLATBED_TARP_REQUIREMENT_REQUIRED'
          : 'FLATBED_TARP_REQUIREMENT_INVALID',
        'PLANNING',
        true,
        'A valid tarp requirement is needed before flatbed planning.',
        'Set tarpRequired to true or false.'
      );
    }
  }

  const customerReference = value.customerReference;
  let normalizedCustomerReference: string | null = null;
  if (customerReference !== undefined && customerReference !== null) {
    if (typeof customerReference !== 'string') {
      followUp(
        followUps,
        rowNumber,
        `${rowPath}/customerReference`,
        'CUSTOMER_REFERENCE_INVALID',
        null,
        false,
        'The Customer reference was omitted because it is invalid.',
        'Provide text or remove the field.'
      );
    } else {
      const normalized = customerReference.trim();
      if (codePointLength(normalized) > 100) {
        followUp(
          followUps,
          rowNumber,
          `${rowPath}/customerReference`,
          'CUSTOMER_REFERENCE_TOO_LONG',
          null,
          false,
          'The Customer reference was omitted because it is too long.',
          'Limit the Customer reference to 100 Unicode code points.'
        );
      } else {
        normalizedCustomerReference = normalized || null;
      }
    }
  }

  const stops: NormalizedBookingRow['stops'] = [];
  if (!Array.isArray(value.stops)) {
    issue(issues, rowNumber, `${rowPath}/stops`, 'PICKUP_STOP_REQUIRED');
    issue(issues, rowNumber, `${rowPath}/stops`, 'DELIVERY_STOP_REQUIRED');
  } else if (value.stops.length > 50) {
    issue(issues, rowNumber, `${rowPath}/stops`, 'STOP_LIMIT_EXCEEDED');
  } else {
    let pickupCount = 0;
    let deliveryCount = 0;
    for (const [stopIndex, stopValue] of value.stops.entries()) {
      const path = `${rowPath}/stops/${stopIndex}`;
      if (!isRecord(stopValue)) {
        issue(issues, rowNumber, path, 'STOP_TYPE_INVALID');
        continue;
      }
      unknownFields(stopValue, STOP_KEYS, issues, rowNumber, path);
      const stopType = trim(stopValue.type)?.toUpperCase();
      if (stopType !== 'PICKUP' && stopType !== 'DELIVERY') {
        issue(issues, rowNumber, `${path}/type`, 'STOP_TYPE_INVALID');
      } else {
        if (stopType === 'PICKUP') pickupCount += 1;
        else deliveryCount += 1;
      }

      const address = isRecord(stopValue.address) ? stopValue.address : {};
      if (!isRecord(stopValue.address)) {
        issue(issues, rowNumber, `${path}/address`, 'STOP_ADDRESS_FIELD_REQUIRED');
      }
      unknownFields(address, ADDRESS_KEYS, issues, rowNumber, `${path}/address`);
      const addressLine1 = trim(address.addressLine1);
      const city = trim(address.city);
      const stateCode = trim(address.stateCode)?.toUpperCase();
      const postalCode = trim(address.postalCode);
      for (const [field, fieldValue] of [
        ['addressLine1', addressLine1],
        ['city', city],
        ['stateCode', stateCode],
        ['postalCode', postalCode],
      ] as const) {
        if (!fieldValue) {
          issue(issues, rowNumber, `${path}/address/${field}`, 'STOP_ADDRESS_FIELD_REQUIRED');
        }
      }
      if (addressLine1 && codePointLength(addressLine1) > 200) {
        issue(issues, rowNumber, `${path}/address/addressLine1`, 'STOP_ADDRESS_FIELD_TOO_LONG');
      }
      if (city && codePointLength(city) > 120) {
        issue(issues, rowNumber, `${path}/address/city`, 'STOP_CITY_TOO_LONG');
      }
      const rawAddressLine2 = address.addressLine2;
      const addressLine2 = trim(rawAddressLine2);
      if (
        rawAddressLine2 !== undefined &&
        rawAddressLine2 !== null &&
        typeof rawAddressLine2 !== 'string'
      ) {
        issue(issues, rowNumber, `${path}/address/addressLine2`, 'STOP_ADDRESS_FIELD_REQUIRED');
      } else if (addressLine2 && codePointLength(addressLine2) > 200) {
        issue(issues, rowNumber, `${path}/address/addressLine2`, 'STOP_ADDRESS_FIELD_TOO_LONG');
      }
      if (stateCode && !STATE_CODES.has(stateCode)) {
        issue(issues, rowNumber, `${path}/address/stateCode`, 'STOP_STATE_CODE_INVALID');
      }
      if (postalCode && !/^\d{5}(?:-\d{4})?$/.test(postalCode)) {
        issue(issues, rowNumber, `${path}/address/postalCode`, 'STOP_POSTAL_CODE_INVALID');
      }
      const countryCode =
        address.countryCode === undefined || address.countryCode === null
          ? 'US'
          : trim(address.countryCode)?.toUpperCase();
      if (countryCode !== 'US') {
        issue(issues, rowNumber, `${path}/address/countryCode`, 'STOP_COUNTRY_UNSUPPORTED');
      }

      let latitude: number | null = null;
      let longitude: number | null = null;
      if (address.coordinates !== undefined && address.coordinates !== null) {
        const coordinates = isRecord(address.coordinates) ? address.coordinates : {};
        unknownFields(
          coordinates,
          COORDINATE_KEYS,
          issues,
          rowNumber,
          `${path}/address/coordinates`
        );
        const parsedLatitude = formatCoordinate(coordinates.latitude, -90, 90);
        const parsedLongitude = formatCoordinate(coordinates.longitude, -180, 180);
        if (parsedLatitude === null || parsedLongitude === null) {
          followUp(
            followUps,
            rowNumber,
            `${path}/address/coordinates`,
            'STOP_COORDINATES_INVALID',
            null,
            false,
            'The supplied coordinates were omitted because they are invalid.',
            'Provide both valid WGS 84 coordinates or remove the coordinates.'
          );
        } else {
          latitude = parsedLatitude;
          longitude = parsedLongitude;
        }
      }

      const window = isRecord(stopValue.appointmentWindow) ? stopValue.appointmentWindow : {};
      if (!isRecord(stopValue.appointmentWindow)) {
        issue(issues, rowNumber, `${path}/appointmentWindow`, 'STOP_WINDOW_INVALID');
      }
      unknownFields(window, WINDOW_KEYS, issues, rowNumber, `${path}/appointmentWindow`);
      const start = parseTimestamp(window.startAt);
      const end = parseTimestamp(window.endAt);
      const timeZone = validTimeZone(window.timeZone);
      if (!start || !end || start.instant.getTime() >= end.instant.getTime()) {
        issue(issues, rowNumber, `${path}/appointmentWindow`, 'STOP_WINDOW_INVALID');
      }
      if (!timeZone) {
        issue(issues, rowNumber, `${path}/appointmentWindow/timeZone`, 'STOP_TIME_ZONE_INVALID');
      } else if (start && end) {
        if (offsetAt(timeZone, start.instant) !== start.offsetMinutes) {
          issue(
            issues,
            rowNumber,
            `${path}/appointmentWindow/startAt`,
            'STOP_TIME_ZONE_OFFSET_MISMATCH'
          );
        }
        if (offsetAt(timeZone, end.instant) !== end.offsetMinutes) {
          issue(
            issues,
            rowNumber,
            `${path}/appointmentWindow/endAt`,
            'STOP_TIME_ZONE_OFFSET_MISMATCH'
          );
        }
      }

      const optionalValues = {
        facilityName: optionalFollowUpText(
          stopValue.facilityName,
          120,
          rowNumber,
          `${path}/facilityName`,
          followUps
        ),
        contactName: optionalFollowUpText(
          stopValue.contactName,
          120,
          rowNumber,
          `${path}/contactName`,
          followUps
        ),
        contactPhone: optionalFollowUpText(
          stopValue.contactPhone,
          32,
          rowNumber,
          `${path}/contactPhone`,
          followUps
        ),
        accessInstructions: optionalFollowUpText(
          stopValue.accessInstructions,
          1000,
          rowNumber,
          `${path}/accessInstructions`,
          followUps
        ),
      };
      const phoneMatch = optionalValues.contactPhone
        ? /^(\+?[\d(). -]+?)(?:\s*(?:x|ext\.?|#)\s*(\d{1,6}))?$/i.exec(optionalValues.contactPhone)
        : null;
      const mainPhoneDigits = phoneMatch?.[1]?.replace(/\D/g, '').length ?? 0;
      if (
        optionalValues.contactPhone &&
        (!phoneMatch || mainPhoneDigits < 7 || mainPhoneDigits > 15)
      ) {
        optionalValues.contactPhone = null;
        followUp(
          followUps,
          rowNumber,
          `${path}/contactPhone`,
          'STOP_CONTACT_PHONE_INVALID',
          null,
          false,
          'The contact phone was omitted because its format is invalid.',
          'Provide a phone number with 7–15 digits and an optional extension.'
        );
      }
      if (stopType === 'PICKUP' || stopType === 'DELIVERY') {
        stops.push({
          stopType,
          addressLine1: addressLine1 ?? '',
          addressLine2: addressLine2 || null,
          city: city ?? '',
          stateCode: stateCode ?? '',
          postalCode: postalCode ?? '',
          countryCode: 'US',
          latitude,
          longitude,
          appointmentStartAt: start?.utc ?? '',
          appointmentEndAt: end?.utc ?? '',
          timeZone: timeZone ?? '',
          facilityName: optionalValues.facilityName,
          contactName: optionalValues.contactName,
          contactPhone: optionalValues.contactPhone,
          accessInstructions: optionalValues.accessInstructions,
        });
      }
    }
    if (pickupCount === 0) {
      issue(issues, rowNumber, `${rowPath}/stops`, 'PICKUP_STOP_REQUIRED');
    }
    if (deliveryCount === 0) {
      issue(issues, rowNumber, `${rowPath}/stops`, 'DELIVERY_STOP_REQUIRED');
    }
    const firstType = isRecord(value.stops[0]) ? trim(value.stops[0].type)?.toUpperCase() : null;
    const finalStop = value.stops.at(-1);
    const finalType = isRecord(finalStop) ? trim(finalStop.type)?.toUpperCase() : null;
    if (value.stops.length > 0 && (firstType !== 'PICKUP' || finalType !== 'DELIVERY')) {
      issue(issues, rowNumber, `${rowPath}/stops`, 'STOP_SEQUENCE_INVALID');
    }
  }

  const specialHandlingCodes: string[] = [];
  if (value.specialHandlingCodes !== undefined && value.specialHandlingCodes !== null) {
    if (!Array.isArray(value.specialHandlingCodes)) {
      followUp(
        followUps,
        rowNumber,
        `${rowPath}/specialHandlingCodes`,
        'SPECIAL_HANDLING_CODE_INVALID',
        'PLANNING',
        true,
        'Special handling codes were omitted because the value is invalid.',
        'Provide an array containing OVERSIZE and/or HAZMAT.'
      );
    } else {
      for (const [index, codeValue] of value.specialHandlingCodes.entries()) {
        const code = trim(codeValue)?.toUpperCase();
        if (code !== 'OVERSIZE' && code !== 'HAZMAT') {
          followUp(
            followUps,
            rowNumber,
            `${rowPath}/specialHandlingCodes/${index}`,
            'SPECIAL_HANDLING_CODE_INVALID',
            'PLANNING',
            true,
            'This special handling code was omitted because it is invalid.',
            'Use OVERSIZE or HAZMAT.'
          );
        } else if (!specialHandlingCodes.includes(code)) {
          specialHandlingCodes.push(code);
          followUp(
            followUps,
            rowNumber,
            `${rowPath}/specialHandlingCodes/${index}`,
            'SPECIAL_HANDLING_UNSUPPORTED',
            'PLANNING',
            true,
            'This special-handling capability is not yet supported for automated work.',
            'Resolve the requirement through an approved manual workflow.'
          );
        }
      }
    }
  }

  const freightLines: NormalizedBookingRow['freightLines'] = [];
  if (!Array.isArray(value.freightLines) || value.freightLines.length === 0) {
    issue(issues, rowNumber, `${rowPath}/freightLines`, 'FREIGHT_LINE_REQUIRED');
  } else if (value.freightLines.length > 500) {
    issue(issues, rowNumber, `${rowPath}/freightLines`, 'FREIGHT_LINE_LIMIT_EXCEEDED');
  } else {
    for (const [lineIndex, lineValue] of value.freightLines.entries()) {
      const path = `${rowPath}/freightLines/${lineIndex}`;
      if (!isRecord(lineValue)) {
        issue(issues, rowNumber, path, 'FREIGHT_DESCRIPTION_REQUIRED');
        continue;
      }
      unknownFields(lineValue, FREIGHT_KEYS, issues, rowNumber, path);
      const description = trim(lineValue.description);
      if (!description) {
        issue(issues, rowNumber, `${path}/description`, 'FREIGHT_DESCRIPTION_REQUIRED');
      } else if (codePointLength(description) > 500) {
        issue(issues, rowNumber, `${path}/description`, 'FREIGHT_DESCRIPTION_TOO_LONG');
      }

      const rawQuantity = trim(lineValue.quantity);
      if (!rawQuantity) {
        issue(issues, rowNumber, `${path}/quantity`, 'FREIGHT_QUANTITY_REQUIRED');
      } else if (
        !/^\d+$/.test(rawQuantity) ||
        BigInt(rawQuantity) < 1n ||
        BigInt(rawQuantity) > 999_999_999_999n
      ) {
        issue(issues, rowNumber, `${path}/quantity`, 'FREIGHT_QUANTITY_INVALID');
      }
      const quantity =
        rawQuantity && /^\d+$/.test(rawQuantity) ? BigInt(rawQuantity).toString() : '0';

      const handlingUnitCode = trim(lineValue.handlingUnitCode)?.toUpperCase();
      if (!handlingUnitCode || !HANDLING_UNIT_CODES.has(handlingUnitCode)) {
        issue(issues, rowNumber, `${path}/handlingUnitCode`, 'HANDLING_UNIT_INVALID');
      }
      let handlingUnitDescription: string | null = null;
      const suppliedDescription = lineValue.handlingUnitDescription;
      if (handlingUnitCode === 'OTHER') {
        if (
          suppliedDescription !== undefined &&
          suppliedDescription !== null &&
          typeof suppliedDescription !== 'string'
        ) {
          issue(
            issues,
            rowNumber,
            `${path}/handlingUnitDescription`,
            'OTHER_HANDLING_UNIT_DESCRIPTION_INVALID'
          );
        } else {
          handlingUnitDescription = trim(suppliedDescription);
          if (!handlingUnitDescription) {
            issue(
              issues,
              rowNumber,
              `${path}/handlingUnitDescription`,
              'OTHER_HANDLING_UNIT_DESCRIPTION_REQUIRED'
            );
          } else if (codePointLength(handlingUnitDescription) > 120) {
            issue(
              issues,
              rowNumber,
              `${path}/handlingUnitDescription`,
              'OTHER_HANDLING_UNIT_DESCRIPTION_TOO_LONG'
            );
          }
        }
      } else if (suppliedDescription !== undefined && suppliedDescription !== null) {
        followUp(
          followUps,
          rowNumber,
          `${path}/handlingUnitDescription`,
          'HANDLING_UNIT_DESCRIPTION_NOT_APPLICABLE',
          null,
          false,
          'The handling-unit description was omitted because it does not apply.',
          'Remove the description or select OTHER.'
        );
      }

      if (typeof lineValue.stackable !== 'boolean') {
        issue(
          issues,
          rowNumber,
          `${path}/stackable`,
          lineValue.stackable === undefined
            ? 'FREIGHT_STACKABILITY_REQUIRED'
            : 'FREIGHT_STACKABILITY_INVALID'
        );
      }

      let length: string | null = null;
      let width: string | null = null;
      let height: string | null = null;
      let dimensionUnit: string | null = null;
      const dimensionsSupplied =
        lineValue.dimensions !== undefined && lineValue.dimensions !== null;
      if (dimensionsSupplied) {
        const dimensions = isRecord(lineValue.dimensions) ? lineValue.dimensions : null;
        if (dimensions) {
          unknownFields(dimensions, DIMENSION_KEYS, issues, rowNumber, `${path}/dimensions`);
          const dimensionLength = trim(dimensions.length);
          const dimensionWidth = trim(dimensions.width);
          const dimensionHeight = trim(dimensions.height);
          const unit = trim(dimensions.unit)?.toUpperCase() ?? null;
          const canonicalLength = dimensionLength ? canonicalDecimal(dimensionLength, 2, 8) : null;
          const canonicalWidth = dimensionWidth ? canonicalDecimal(dimensionWidth, 2, 8) : null;
          const canonicalHeight = dimensionHeight ? canonicalDecimal(dimensionHeight, 2, 8) : null;
          if (
            canonicalLength &&
            canonicalWidth &&
            canonicalHeight &&
            (unit === 'IN' || unit === 'CM')
          ) {
            length = canonicalLength;
            width = canonicalWidth;
            height = canonicalHeight;
            dimensionUnit = unit;
          }
        }
      }
      const dimensionsValid =
        length !== null && width !== null && height !== null && dimensionUnit !== null;
      const dimensionsRequired =
        lineValue.stackable === true || normalizedEquipmentProfile === 'FLATBED';
      if (dimensionsRequired && !dimensionsSupplied) {
        followUp(
          followUps,
          rowNumber,
          `${path}/dimensions`,
          'FREIGHT_LINE_DIMENSIONS_REQUIRED',
          'PLANNING',
          true,
          'Freight dimensions are required before planning.',
          'Provide positive length, width, height, and a shared unit.'
        );
      } else if (dimensionsSupplied && !dimensionsValid) {
        followUp(
          followUps,
          rowNumber,
          `${path}/dimensions`,
          dimensionsRequired
            ? 'FREIGHT_LINE_DIMENSIONS_INVALID'
            : 'FREIGHT_LINE_DIMENSIONS_INVALID_OPTIONAL',
          dimensionsRequired ? 'PLANNING' : null,
          dimensionsRequired,
          'The supplied freight dimensions were omitted because they are invalid.',
          'Provide positive length, width, height, and a shared unit.'
        );
      }

      freightLines.push({
        description: description ?? '',
        quantity,
        handlingUnitCode: handlingUnitCode ?? '',
        handlingUnitDescription:
          handlingUnitCode === 'OTHER' &&
          handlingUnitDescription &&
          codePointLength(handlingUnitDescription) <= 120
            ? handlingUnitDescription
            : null,
        stackable: lineValue.stackable === true,
        length,
        width,
        height,
        dimensionUnit,
      });
    }
  }

  const rowIssues = issues.length > initialIssueCount;
  if (rowIssues || !customerId || !customerNameSnapshot || !customerRateAmount) {
    return null;
  }

  return {
    customerId,
    customerNameSnapshot,
    customerReference: normalizedCustomerReference,
    customerRateAmount,
    equipmentProfile: normalizedEquipmentProfile,
    totalGrossWeightValue,
    totalGrossWeightUnit,
    temperatureMinimum,
    temperatureMaximum,
    temperatureUnit,
    reeferMode,
    tarpRequired,
    stops,
    freightLines,
    specialHandlingCodes,
  };
}

export function evaluateBookingSubmission(
  rows: unknown[],
  customerFacts: Record<string, CustomerBookingFactResult>
): BookingEvaluation {
  const issues: BookingIssue[] = [];
  const followUpItems: BookingFollowUp[] = [];
  if (rows.length === 0 || rows.length > 100) {
    issue(
      issues,
      1,
      '/rows',
      'STOP_SEQUENCE_INVALID',
      'A booking must contain between 1 and 100 Load rows.',
      'Submit between 1 and 100 Load rows.'
    );
  }
  const normalizedRows = rows.map((row, index) =>
    normalizeRow(row, index, customerFacts, issues, followUpItems)
  );
  const sortByLocationAndCode = (
    left: { rowNumber: number; fieldPath: string; code: string },
    right: { rowNumber: number; fieldPath: string; code: string }
  ) =>
    left.rowNumber - right.rowNumber ||
    left.fieldPath.localeCompare(right.fieldPath) ||
    left.code.localeCompare(right.code);
  issues.sort(sortByLocationAndCode);
  const uniqueFollowUps = [
    ...new Map(
      followUpItems.map((item) => [`${item.rowNumber}:${item.fieldPath}:${item.code}`, item])
    ).values(),
  ];
  uniqueFollowUps.sort(sortByLocationAndCode);
  return { normalizedRows, issues, followUpItems: uniqueFollowUps };
}
