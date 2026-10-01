import { Observable, of, throwError } from 'rxjs';

import {
  MOCK_SFTP_BASE,
  MOCK_SFTP_USER,
  SFTP_BUCKETS,
  SFTP_CLIENT_TYPES,
  SFTP_NAME_PATTERN,
  SFTP_WARNING_KEYS_IGNORED,
  SFTP_WARNING_PASSWORD_KEPT,
  SftpAccountConfig,
  SftpAccountLookup,
  SftpAccountPreview,
  SftpAccountRequest,
  SftpAccountResult,
  SftpPasswordMode,
  SftpPreviewFolder,
  SftpPreviewUserAction,
  SftpVirtualFolder,
} from '../../models/sftp-account.model';
import { ApiException } from '../api-error';
import { SftpAccountApi } from '../sftp-account-api';

const PASSWORD_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.!@#%+=';

interface StoredFolder {
  name: string;
  bucket: string;
}

interface StoredUser {
  username: string;
  bucket: string;
  virtualFolders: SftpVirtualFolder[];
  publicKeys: string[];
}

export interface MockSftpOptions {
  configured?: boolean;
}

export class MockSftpAccountApi implements SftpAccountApi {
  private readonly configured: boolean;
  private readonly users = new Map<string, StoredUser>();
  private readonly folders = new Map<string, StoredFolder>();

  constructor(options: MockSftpOptions = {}) {
    this.configured = options.configured ?? true;
    if (this.configured) {
      this.seed();
    }
  }

  config(): Observable<SftpAccountConfig> {
    return of({
      configured: this.configured,
      clientTypes: {
        publisher: [...SFTP_CLIENT_TYPES.publisher],
        advertiser: [...SFTP_CLIENT_TYPES.advertiser],
      },
      buckets: { ...SFTP_BUCKETS },
    });
  }

  lookup(username: string): Observable<SftpAccountLookup> {
    if (!this.configured) {
      return this.unavailable();
    }
    const user = this.users.get(username);
    if (!user) {
      return of({ username, exists: false, virtualFolders: [], bases: [] });
    }
    return of({
      username: user.username,
      exists: true,
      bucket: user.bucket,
      virtualFolders: user.virtualFolders.map((folder) => ({ ...folder })),
      bases: basesOf(user.virtualFolders),
    });
  }

  preview(body: SftpAccountRequest): Observable<SftpAccountPreview> {
    const planned = this.plan(body);
    if (planned instanceof ApiException) {
      return throwError(() => planned);
    }
    return of(planned.preview);
  }

  create(body: SftpAccountRequest): Observable<SftpAccountResult> {
    const planned = this.plan(body);
    if (planned instanceof ApiException) {
      return throwError(() => planned);
    }
    const { preview, passwordMode, publicKeys } = planned;
    const createdNames: string[] = [];
    const existingNames: string[] = [];
    for (const folder of preview.folders) {
      if (folder.action === 'create') {
        this.folders.set(folder.name, { name: folder.name, bucket: preview.bucket });
        createdNames.push(folder.name);
      } else {
        existingNames.push(folder.name);
      }
    }

    const current = this.users.get(preview.user);
    const wanted = preview.folders.map((folder) => ({
      name: folder.name,
      virtualPath: folder.virtualPath,
    }));
    let addedVirtualFolders = 0;
    let generatedPassword: string | undefined;
    if (!current) {
      const virtualFolders = wanted;
      addedVirtualFolders = virtualFolders.length;
      this.users.set(preview.user, {
        username: preview.user,
        bucket: preview.bucket,
        virtualFolders,
        publicKeys,
      });
      if (passwordMode === 'generate') {
        generatedPassword = generatePassword();
      }
    } else {
      const present = new Set(current.virtualFolders.map((folder) => folder.virtualPath));
      const extra = wanted.filter((folder) => !present.has(folder.virtualPath));
      addedVirtualFolders = extra.length;
      current.virtualFolders = [...current.virtualFolders, ...extra];
    }

    const stored = this.users.get(preview.user);
    const got = new Set((stored?.virtualFolders ?? []).map((folder) => folder.virtualPath));
    const missing = wanted.map((folder) => folder.virtualPath).filter((path) => !got.has(path));
    const result: SftpAccountResult = {
      user: preview.user,
      base: preview.base,
      clientType: preview.clientType,
      bucket: preview.bucket,
      subfolders: preview.subfolders,
      foldersCreated: createdNames,
      foldersExisting: existingNames,
      userAction: past(preview.userAction),
      addedVirtualFolders,
      verified: missing.length === 0,
    };
    if (missing.length) {
      result.missing = missing;
    }
    if (generatedPassword) {
      result.generatedPassword = generatedPassword;
    }
    return of(result);
  }

  private plan(body: SftpAccountRequest): Planned | ApiException {
    if (!this.configured) {
      return unconfigured();
    }
    const issues = validate(body);
    if (issues.length) {
      return new ApiException(422, 'validation_error', issues[0].message, issues);
    }
    const clientType = body.clientType;
    const userName = body.user.trim();
    const baseName = body.base.trim();
    const bucket = SFTP_BUCKETS[clientType];
    const subfolders = [...SFTP_CLIENT_TYPES[clientType]];
    const passwordMode: SftpPasswordMode = body.passwordMode ?? 'generate';
    const publicKeys = (body.publicKeys ?? []).map((key) => key.trim()).filter(Boolean);
    const user = this.users.get(userName);
    if (user && user.bucket !== bucket) {
      return bucketMismatch(`user ${userName} is on bucket ${user.bucket}, expected ${bucket}`);
    }

    const present = new Set((user?.virtualFolders ?? []).map((folder) => folder.virtualPath));
    const folders: SftpPreviewFolder[] = [];
    for (const sub of subfolders) {
      const name = `${userName}/${baseName}/${sub}`;
      const virtualPath = `/${baseName}/${sub}`;
      const existing = this.folders.get(name);
      if (existing && existing.bucket !== bucket) {
        return bucketMismatch(
          `folder ${name} exists on bucket ${existing.bucket}, expected ${bucket}`,
        );
      }
      folders.push({
        name,
        virtualPath,
        action: existing || present.has(virtualPath) ? 'exists' : 'create',
      });
    }

    let userAction: SftpPreviewUserAction;
    if (!user) {
      userAction = 'create';
    } else if (folders.every((folder) => present.has(folder.virtualPath))) {
      userAction = 'unchanged';
    } else {
      userAction = 'update';
    }

    const warnings: string[] = [];
    if (userAction !== 'create') {
      warnings.push(SFTP_WARNING_PASSWORD_KEPT);
      if (publicKeys.length > 0) {
        warnings.push(SFTP_WARNING_KEYS_IGNORED);
      }
    }

    return {
      passwordMode,
      publicKeys,
      preview: {
        user: userName,
        base: baseName,
        clientType,
        bucket,
        subfolders,
        folders,
        userAction,
        warnings,
      },
    };
  }

  private seed(): void {
    const virtualFolders = SFTP_CLIENT_TYPES.publisher.map((sub) => ({
      name: `${MOCK_SFTP_USER}/${MOCK_SFTP_BASE}/${sub}`,
      virtualPath: `/${MOCK_SFTP_BASE}/${sub}`,
    }));
    this.users.set(MOCK_SFTP_USER, {
      username: MOCK_SFTP_USER,
      bucket: SFTP_BUCKETS.publisher,
      virtualFolders,
      publicKeys: [],
    });
    for (const folder of virtualFolders) {
      this.folders.set(folder.name, { name: folder.name, bucket: SFTP_BUCKETS.publisher });
    }
  }

  private unavailable(): Observable<never> {
    return throwError(() => unconfigured());
  }
}

interface Planned {
  preview: SftpAccountPreview;
  passwordMode: SftpPasswordMode;
  publicKeys: string[];
}

function validate(body: SftpAccountRequest): { field: string; message: string }[] {
  const issues: { field: string; message: string }[] = [];
  if (!body.user?.trim()) {
    issues.push({ field: 'user', message: 'Enter an SFTP user name.' });
  } else if (!SFTP_NAME_PATTERN.test(body.user.trim())) {
    issues.push({
      field: 'user',
      message: 'Use lowercase letters, digits, hyphens, and underscores.',
    });
  }
  if (!body.base?.trim()) {
    issues.push({ field: 'base', message: 'Enter a client base name.' });
  } else if (!SFTP_NAME_PATTERN.test(body.base.trim())) {
    issues.push({
      field: 'base',
      message: 'Use lowercase letters, digits, hyphens, and underscores.',
    });
  }
  if (body.clientType !== 'publisher' && body.clientType !== 'advertiser') {
    issues.push({ field: 'clientType', message: 'Choose a publisher or an advertiser.' });
  }
  const mode = body.passwordMode ?? 'generate';
  const keys = (body.publicKeys ?? []).map((key) => key.trim()).filter(Boolean);
  if (mode === 'none' && keys.length === 0) {
    issues.push({
      field: 'publicKeys',
      message: 'Add at least one SSH public key, or generate a password.',
    });
  }
  return issues;
}

function bucketMismatch(message: string): ApiException {
  return new ApiException(409, 'bucket_mismatch', message);
}

function unconfigured(): ApiException {
  return new ApiException(
    503,
    'sftpgo_unconfigured',
    'sftpgo is not configured: set SFTPGO_URL and SFTPGO_API_KEY',
  );
}

function past(action: SftpPreviewUserAction): SftpAccountResult['userAction'] {
  if (action === 'create') {
    return 'created';
  }
  if (action === 'update') {
    return 'updated';
  }
  return 'unchanged';
}

function basesOf(folders: readonly SftpVirtualFolder[]): string[] {
  const bases = new Set<string>();
  for (const folder of folders) {
    const [base] = folder.virtualPath.split('/').filter(Boolean);
    if (base) {
      bases.add(base);
    }
  }
  return [...bases].sort();
}

function generatePassword(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('');
}
