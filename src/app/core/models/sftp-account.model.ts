export type SftpClientType = 'publisher' | 'advertiser';
export type SftpPasswordMode = 'generate' | 'none';
export type SftpFolderAction = 'create' | 'exists';
export type SftpPreviewUserAction = 'create' | 'update' | 'unchanged';
export type SftpCreateUserAction = 'created' | 'updated' | 'unchanged';

export interface SftpClientTypes {
  publisher: string[];
  advertiser: string[];
}

export interface SftpBuckets {
  publisher: string;
  advertiser: string;
}

export interface SftpAccountConfig {
  configured: boolean;
  clientTypes: SftpClientTypes;
  buckets: SftpBuckets;
}

export interface SftpVirtualFolder {
  name: string;
  virtualPath: string;
}

export interface SftpAccountLookup {
  username: string;
  exists: boolean;
  bucket?: string;
  virtualFolders: SftpVirtualFolder[];
  bases: string[];
}

export interface SftpAccountRequest {
  user: string;
  base: string;
  clientType: SftpClientType;
  passwordMode?: SftpPasswordMode;
  publicKeys?: string[];
}

export interface SftpPreviewFolder {
  name: string;
  virtualPath: string;
  action: SftpFolderAction;
}

export interface SftpAccountPreview {
  user: string;
  base: string;
  clientType: SftpClientType;
  bucket: string;
  subfolders: string[];
  folders: SftpPreviewFolder[];
  userAction: SftpPreviewUserAction;
  warnings: string[];
}

export interface SftpAccountResult {
  user: string;
  base: string;
  clientType: SftpClientType;
  bucket: string;
  subfolders: string[];
  foldersCreated: string[];
  foldersExisting: string[];
  userAction: SftpCreateUserAction;
  addedVirtualFolders: number;
  generatedPassword?: string;
  verified: boolean;
  missing?: string[];
}

/** Subfolders created for each client type. The config endpoint is the source of truth. */
export const SFTP_CLIENT_TYPES: SftpClientTypes = {
  publisher: ['optin', 'optout', 'stop'],
  advertiser: ['blacklists', 'customers', 'stores', 'sales'],
};

/** Dev bucket names from the SFTPGo convention this screen replaces. */
export const SFTP_BUCKETS: SftpBuckets = {
  publisher: 'dkp-dmc-publishers-raw-euw1-dev',
  advertiser: 'dkp-dmc-advertisers-raw-euw1-dev',
};

export const SFTP_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

/** Preview notes returned for an existing user. They are not errors. */
export const SFTP_WARNING_PASSWORD_KEPT = 'existing password is kept';
export const SFTP_WARNING_KEYS_IGNORED = 'public keys are only applied when the user is created';

export const MOCK_SFTP_USER = 'demo_retail';
export const MOCK_SFTP_BASE = 'demo_fr';
