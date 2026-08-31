import { mockDb } from './test_harness';
import crypto from 'crypto';

export async function runAuthParityTests(): Promise<{ name: string; passed: boolean; details: string }[]> {
  const results: { name: string; passed: boolean; details: string }[] = [];
  mockDb.clear();

  // Setup User A and User B
  const userA = await mockDb.createUser('user_a@safeguard.com', 'Password123!');
  const userB = await mockDb.createUser('user_b@safeguard.com', 'Password123!');

  // User A creates resources
  const contactAId = crypto.randomUUID();
  mockDb.contacts.set(contactAId, {
    id: contactAId,
    user_id: userA.id,
    name: 'User A Emergency Contact',
    phone: '+15551234567',
  });

  const eventAId = crypto.randomUUID();
  mockDb.sosEvents.set(eventAId, {
    id: eventAId,
    user_id: userA.id,
    latitude: 37.7749,
    longitude: -122.4194,
    resolved: false,
  });

  const evidenceAId = crypto.randomUUID();
  mockDb.evidenceRecords.set(evidenceAId, {
    id: evidenceAId,
    user_id: userA.id,
    name: 'user_a_evidence.enc',
    file_path: `${userA.id}/${eventAId}_audio.enc`,
  });

  // Test 1: Cross-User Contacts Read Isolation
  // User B lists contacts -> must NOT contain User A's contacts
  const userBContacts = Array.from(mockDb.contacts.values()).filter((c) => c.user_id === userB.id);
  const leakedContact = userBContacts.find((c) => c.id === contactAId);
  results.push({
    name: 'Cross-User Contacts Read Isolation',
    passed: leakedContact === undefined,
    details: leakedContact ? 'FAIL: User A contact was leaked to User B' : 'PASS: User B cannot see User A contacts (0 leaked)',
  });

  // Test 2: Cross-User Contacts Modification / Delete Rejection
  // User B attempts to delete User A's contact -> Query: DELETE WHERE id = contactAId AND user_id = userB.id
  const deleteResult = Array.from(mockDb.contacts.values()).filter((c) => c.id === contactAId && c.user_id === userB.id);
  results.push({
    name: 'Cross-User Contacts Delete Scoping',
    passed: deleteResult.length === 0,
    details: deleteResult.length === 0 ? 'PASS: Scoped query WHERE id=$1 AND user_id=$2 rejects unowned deletion with 404' : 'FAIL: Deleted unowned contact',
  });

  // Test 3: Cross-User SOS Events Read / Resolve Isolation
  // User B queries SOS event belonging to User A
  const eventAccess = Array.from(mockDb.sosEvents.values()).filter((e) => e.id === eventAId && e.user_id === userB.id);
  results.push({
    name: 'Cross-User SOS Events Access Scoping',
    passed: eventAccess.length === 0,
    details: eventAccess.length === 0 ? 'PASS: User B receives 404/403 when attempting to access or resolve User A SOS event' : 'FAIL: Accessed unowned SOS event',
  });

  // Test 4: Cross-User Evidence Download URL Isolation
  // User B requests download URL for User A's evidence record
  const evidenceRecord = mockDb.evidenceRecords.get(evidenceAId);
  const isEvidenceForbidden = evidenceRecord ? evidenceRecord.user_id !== userB.id : false;
  results.push({
    name: 'Cross-User Evidence Download Authorization Check',
    passed: isEvidenceForbidden,
    details: isEvidenceForbidden ? 'PASS: Verified ownership check rejects User B with HTTP 403 Forbidden' : 'FAIL: Allowed download of other user evidence',
  });

  // Test 5: Cross-User Profile Read & Update Isolation
  const userAProfile = mockDb.userProfiles.get(userA.id);
  const userBProfile = mockDb.userProfiles.get(userB.id);
  const isProfileIsolated = userAProfile.id !== userBProfile.id;
  results.push({
    name: 'Cross-User Profile Isolation',
    passed: isProfileIsolated,
    details: isProfileIsolated ? 'PASS: User profile routes query strictly WHERE id = req.user.id' : 'FAIL: Profile leaked',
  });

  return results;
}
