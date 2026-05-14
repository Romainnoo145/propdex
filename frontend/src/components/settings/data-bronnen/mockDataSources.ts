/**
 * Storybook + test fixtures for DataSourceRow — M049/S03.
 *
 * Inline mock data (no MSW server). Each fixture targets one of the 4
 * status states the row must render correctly.
 */
import type { DataSourceRow } from '@/lib/types/data-sources-admin'

export const mockLiveRow: DataSourceRow = {
  source_key: 'woonvisie',
  label_nl: 'Woonvisie / Volkshuisvestingsprogramma',
  source_type: 'A',
  status: 'live',
  last_checked: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2u geleden
  error_message: null,
  configuratie: null,
  available_actions: [
    { action: 'view_versions', enabled: true, label_nl: 'Bekijk versies', reason_disabled: null },
    { action: 'upload', enabled: true, label_nl: 'Upload', reason_disabled: null },
    { action: 'refresh', enabled: true, label_nl: 'Vernieuw status', reason_disabled: null },
  ],
}

export const mockBrokenRow: DataSourceRow = {
  source_key: 'omgevingsvisie',
  label_nl: 'Omgevingsvisie (gemeente)',
  source_type: 'A',
  status: 'broken',
  last_checked: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  error_message: 'Upload faalde: bestand corrupt (laatste poging 3 dagen geleden).',
  configuratie: null,
  available_actions: [
    { action: 'upload', enabled: true, label_nl: 'Upload', reason_disabled: null },
    { action: 'refresh', enabled: true, label_nl: 'Vernieuw status', reason_disabled: null },
  ],
}

export const mockMissingRow: DataSourceRow = {
  source_key: 'huisvestingsverordening',
  label_nl: 'Huisvestingsverordening',
  source_type: 'A',
  status: 'missing',
  last_checked: null,
  error_message: null,
  configuratie: null,
  available_actions: [
    { action: 'upload', enabled: true, label_nl: 'Upload', reason_disabled: null },
    { action: 'refresh', enabled: true, label_nl: 'Vernieuw status', reason_disabled: null },
  ],
}

export const mockNotApplicableRow: DataSourceRow = {
  source_key: 'brk-eigendom',
  label_nl: 'BRK eigendom (paid integration)',
  source_type: 'C',
  status: 'not_applicable',
  last_checked: null,
  error_message: null,
  configuratie: null,
  available_actions: [
    {
      action: 'configure_credential',
      enabled: false,
      label_nl: 'Configureer credential',
      reason_disabled: 'Beschikbaar vanaf S05',
    },
    {
      action: 'refresh',
      enabled: false,
      label_nl: 'Vernieuw status',
      reason_disabled: 'Beschikbaar vanaf S05',
    },
  ],
}
