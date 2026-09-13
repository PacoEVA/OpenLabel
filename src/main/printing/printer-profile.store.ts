import {
  type PrinterProfile,
  PrinterProfileSchema,
} from '../../core/printing';

export class PrinterProfileStore {
  private readonly profiles = new Map<string, PrinterProfile>();

  constructor(initialProfiles: PrinterProfile[] = []) {
    for (const p of initialProfiles) {
      this.save(p);
    }
  }

  public list(): PrinterProfile[] {
    return Array.from(this.profiles.values());
  }

  public get(id: string): PrinterProfile | undefined {
    return this.profiles.get(id);
  }

  public save(rawProfile: unknown): PrinterProfile {
    const validated = PrinterProfileSchema.parse(rawProfile);
    const now = new Date().toISOString();
    const existing = this.profiles.get(validated.id);

    const profile: PrinterProfile = {
      ...validated,
      createdAt: existing?.createdAt ?? validated.createdAt ?? now,
      updatedAt: now,
    };

    this.profiles.set(profile.id, profile);
    return profile;
  }

  public delete(id: string): boolean {
    return this.profiles.delete(id);
  }

  public clear(): void {
    this.profiles.clear();
  }
}
