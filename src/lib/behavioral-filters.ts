export interface BehavioralFilterOption {
  key: string;
  label: string;
  description: string;
  params: Array<{ key: string; value: string }>;
}

export const BEHAVIORAL_FILTERS: BehavioralFilterOption[] = [
  {
    key: 'espresso',
    label: 'Espresso için',
    description: 'Espresso demleme yöntemi belirtilen çekirdekler.',
    params: [{ key: 'brewMethod', value: 'espresso' }],
  },
  {
    key: 'filter',
    label: 'V60 / pour over için',
    description: 'Filter/pour over demleme yöntemi belirtilen çekirdekler.',
    params: [{ key: 'brewMethod', value: 'filter' }],
  },
  {
    key: 'turkish',
    label: 'Türk kahvesi için',
    description: 'Türk kahvesi veya cezve kullanımı belirtilen çekirdekler.',
    params: [{ key: 'brewMethod', value: 'turkish' }],
  },
  {
    key: 'fruity-bright',
    label: 'Meyvemsi / canlı',
    description: 'Meyvemsi veya çiçeksi tadım kategorisi olan çekirdekler.',
    params: [
      { key: 'flavorCategory', value: 'Fruity' },
      { key: 'flavorCategory', value: 'Floral' },
    ],
  },
  {
    key: 'classic',
    label: 'Klasik / tanıdık',
    description: 'Çikolata, kuruyemiş veya kavrulmuş tat profili olan çekirdekler.',
    params: [
      { key: 'flavorCategory', value: 'Chocolate' },
      { key: 'flavorCategory', value: 'Nutty' },
      { key: 'flavorCategory', value: 'Roasted' },
    ],
  },
  {
    key: 'experimental',
    label: 'Deneysel / funky',
    description: 'Anaerobik veya deneysel işleme bilgisi olan çekirdekler.',
    params: [
      { key: 'process', value: 'anaerobic' },
      { key: 'process', value: 'experimental' },
    ],
  },
];
