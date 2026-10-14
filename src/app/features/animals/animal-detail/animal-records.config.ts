import { TableColumn } from '../../../shared/components/data-table/data-table.component';

export type RecordKind = 'health' | 'vaccinations' | 'dewormings' | 'breedings' | 'pregnancies' | 'milk-production';

export interface RecordField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select' | 'textarea';
  required?: boolean;
  /** select options (value = label with camelCase split) */
  options?: string[];
  /** bootstrap column width (of 12), default 6 */
  col?: number;
  /** numeric inputs */
  step?: string;
  positive?: boolean;
  /** required only while another field has the given value */
  requiredWhen?: { field: string; value: string };
  hint?: string;
  /** default for new records ('today' = current date) */
  default?: string;
}

export interface RecordConfig {
  resource: string;
  title: string;
  singular: string;
  icon: string;
  /** field used for the date sort/filter column */
  dateKey: string;
  femaleOnly?: boolean;
  fields: RecordField[];
  columns: TableColumn[];
}

const COST: RecordField = { key: 'cost', label: 'Cost (INR)', type: 'number', step: '0.01', col: 4 };
const REMARKS: RecordField = { key: 'remarks', label: 'Remarks', type: 'textarea', col: 12 };
const DONE_STATUS = ['Completed', 'Scheduled', 'Missed'];

export const RECORD_CONFIGS: Record<RecordKind, RecordConfig> = {
  health: {
    resource: 'health',
    title: 'Health records',
    singular: 'health record',
    icon: 'bi-heart-pulse',
    dateKey: 'recordDate',
    fields: [
      { key: 'recordDate', label: 'Record date', type: 'date', required: true, default: 'today', col: 4 },
      { key: 'healthCondition', label: 'Health condition', type: 'text', required: true, col: 8 },
      { key: 'symptoms', label: 'Symptoms', type: 'textarea', col: 12 },
      { key: 'diagnosis', label: 'Diagnosis', type: 'text', col: 6 },
      { key: 'severity', label: 'Severity', type: 'select', options: ['Mild', 'Moderate', 'Severe'], col: 3 },
      { key: 'status', label: 'Status', type: 'select', options: ['Open', 'Ongoing', 'Recovered'], required: true, default: 'Open', col: 3 },
      { key: 'treatment', label: 'Treatment', type: 'text', col: 6 },
      { key: 'medicines', label: 'Medicines', type: 'text', col: 6 },
      { key: 'vetName', label: 'Veterinarian', type: 'text', col: 4 },
      { key: 'followUpDate', label: 'Follow-up date', type: 'date', col: 4 },
      { key: 'recoveredDate', label: 'Recovered date', type: 'date', col: 4, requiredWhen: { field: 'status', value: 'Recovered' } },
      COST,
      REMARKS,
    ],
    columns: [
      { key: 'recordDate', label: 'Date', type: 'date', sortable: true, sortKey: 'date' },
      { key: 'healthCondition', label: 'Condition' },
      { key: 'severity', label: 'Severity' },
      { key: 'diagnosis', label: 'Diagnosis' },
      { key: 'treatment', label: 'Treatment' },
      { key: 'vetName', label: 'Vet' },
      { key: 'cost', label: 'Cost', type: 'currency' },
      { key: 'followUpDate', label: 'Follow-up', type: 'date' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
  },
  vaccinations: {
    resource: 'vaccinations',
    title: 'Vaccinations',
    singular: 'vaccination',
    icon: 'bi-shield-plus',
    dateKey: 'vaccinationDate',
    fields: [
      { key: 'vaccineName', label: 'Vaccine name', type: 'text', required: true, col: 6 },
      { key: 'vaccinationDate', label: 'Vaccination date', type: 'date', required: true, default: 'today', col: 3 },
      { key: 'nextDueDate', label: 'Next due date', type: 'date', col: 3 },
      { key: 'doseNumber', label: 'Dose no.', type: 'number', step: '1', col: 3 },
      { key: 'batchNumber', label: 'Batch no.', type: 'text', col: 3 },
      { key: 'administeredBy', label: 'Administered by', type: 'text', col: 3 },
      { key: 'status', label: 'Status', type: 'select', options: DONE_STATUS, required: true, default: 'Completed', col: 3 },
      COST,
      REMARKS,
    ],
    columns: [
      { key: 'vaccinationDate', label: 'Date', type: 'date', sortable: true, sortKey: 'date' },
      { key: 'vaccineName', label: 'Vaccine' },
      { key: 'doseNumber', label: 'Dose', type: 'number' },
      { key: 'batchNumber', label: 'Batch' },
      { key: 'administeredBy', label: 'By' },
      { key: 'nextDueDate', label: 'Next due', type: 'date' },
      { key: 'cost', label: 'Cost', type: 'currency' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
  },
  dewormings: {
    resource: 'dewormings',
    title: 'Deworming',
    singular: 'deworming record',
    icon: 'bi-bug',
    dateKey: 'dewormingDate',
    fields: [
      { key: 'medicineName', label: 'Medicine', type: 'text', required: true, col: 6 },
      { key: 'dewormingDate', label: 'Deworming date', type: 'date', required: true, default: 'today', col: 3 },
      { key: 'nextDueDate', label: 'Next due date', type: 'date', col: 3 },
      { key: 'dosage', label: 'Dosage', type: 'text', col: 4 },
      { key: 'administeredBy', label: 'Administered by', type: 'text', col: 4 },
      { key: 'status', label: 'Status', type: 'select', options: DONE_STATUS, required: true, default: 'Completed', col: 4 },
      { ...COST, col: 6 },
      { ...REMARKS, col: 6 },
    ],
    columns: [
      { key: 'dewormingDate', label: 'Date', type: 'date', sortable: true, sortKey: 'date' },
      { key: 'medicineName', label: 'Medicine' },
      { key: 'dosage', label: 'Dosage' },
      { key: 'administeredBy', label: 'By' },
      { key: 'nextDueDate', label: 'Next due', type: 'date' },
      { key: 'cost', label: 'Cost', type: 'currency' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
  },
  breedings: {
    resource: 'breedings',
    title: 'Breeding records',
    singular: 'breeding record',
    icon: 'bi-gender-ambiguous',
    dateKey: 'breedingDate',
    femaleOnly: true,
    fields: [
      { key: 'breedingDate', label: 'Breeding date', type: 'date', required: true, default: 'today', col: 4 },
      { key: 'breedingMethod', label: 'Method', type: 'select', options: ['NaturalService', 'ArtificialInsemination'], col: 4 },
      { key: 'heatDate', label: 'Heat date', type: 'date', col: 4 },
      { key: 'bullName', label: 'Bull name', type: 'text', col: 4 },
      { key: 'semenCode', label: 'Semen code', type: 'text', col: 4 },
      { key: 'technicianName', label: 'Technician', type: 'text', col: 4 },
      { key: 'result', label: 'Result', type: 'select', options: ['Pending', 'Successful', 'Failed'], default: 'Pending', col: 3 },
      { key: 'confirmedDate', label: 'Confirmed date', type: 'date', col: 3 },
      { key: 'expectedDeliveryDate', label: 'Expected delivery', type: 'date', col: 3 },
      { ...COST, col: 3 },
      REMARKS,
    ],
    columns: [
      { key: 'breedingDate', label: 'Date', type: 'date', sortable: true, sortKey: 'date' },
      { key: 'breedingMethod', label: 'Method' },
      { key: 'bullName', label: 'Bull' },
      { key: 'semenCode', label: 'Semen code' },
      { key: 'technicianName', label: 'Technician' },
      { key: 'expectedDeliveryDate', label: 'Expected delivery', type: 'date' },
      { key: 'result', label: 'Result', type: 'badge' },
    ],
  },
  pregnancies: {
    resource: 'pregnancies',
    title: 'Pregnancy records',
    singular: 'pregnancy record',
    icon: 'bi-calendar-heart',
    dateKey: 'confirmedDate',
    femaleOnly: true,
    fields: [
      { key: 'confirmedDate', label: 'Confirmed date', type: 'date', required: true, default: 'today', col: 4 },
      { key: 'expectedDeliveryDate', label: 'Expected delivery', type: 'date', required: true, col: 4 },
      { key: 'status', label: 'Status', type: 'select', options: ['Pregnant', 'Delivered', 'Aborted'], required: true, default: 'Pregnant', col: 4 },
      {
        key: 'actualDeliveryDate',
        label: 'Actual delivery date',
        type: 'date',
        col: 4,
        requiredWhen: { field: 'status', value: 'Delivered' },
        hint: 'Delivered records increase lactation no. and set the animal to Milking',
      },
      { key: 'deliveryOutcome', label: 'Delivery outcome', type: 'select', options: ['LiveBirth', 'Stillbirth', 'Abortion'], col: 4 },
      { key: 'calfCount', label: 'Calf count', type: 'number', step: '1', col: 2 },
      { key: 'calfGender', label: 'Calf gender', type: 'select', options: ['Male', 'Female'], col: 2 },
      { key: 'lastCheckupDate', label: 'Last checkup', type: 'date', col: 4 },
      { ...REMARKS, col: 8 },
    ],
    columns: [
      { key: 'confirmedDate', label: 'Confirmed', type: 'date', sortable: true, sortKey: 'date' },
      { key: 'expectedDeliveryDate', label: 'Expected delivery', type: 'date' },
      { key: 'actualDeliveryDate', label: 'Delivered on', type: 'date' },
      { key: 'deliveryOutcome', label: 'Outcome' },
      { key: 'calfCount', label: 'Calves', type: 'number' },
      { key: 'lastCheckupDate', label: 'Last checkup', type: 'date' },
      { key: 'status', label: 'Status', type: 'badge' },
    ],
  },
  'milk-production': {
    resource: 'milk-production',
    title: 'Milk yield',
    singular: 'milk yield entry',
    icon: 'bi-moisture',
    dateKey: 'productionDate',
    femaleOnly: true,
    fields: [
      { key: 'productionDate', label: 'Date', type: 'date', required: true, default: 'today', col: 4 },
      { key: 'shiftName', label: 'Shift', type: 'select', options: ['Morning', 'Evening'], required: true, default: 'Morning', col: 4 },
      { key: 'quantityLiters', label: 'Quantity (litres)', type: 'number', step: '0.01', required: true, positive: true, col: 4 },
      { key: 'fat', label: 'FAT %', type: 'number', step: '0.01', col: 3 },
      { key: 'snf', label: 'SNF %', type: 'number', step: '0.01', col: 3 },
      { ...REMARKS, col: 6 },
    ],
    columns: [
      { key: 'productionDate', label: 'Date', type: 'date', sortable: true, sortKey: 'date' },
      { key: 'shiftName', label: 'Shift' },
      { key: 'quantityLiters', label: 'Litres', type: 'number' },
      { key: 'fat', label: 'FAT', type: 'number' },
      { key: 'snf', label: 'SNF', type: 'number' },
      { key: 'remarks', label: 'Remarks' },
    ],
  },
};
