const { encrypt, decrypt, isEncrypted } = require('../../src/utils/secrets');

describe('secrets (AES-256-GCM)', () => {
  it('chiffre puis déchiffre une chaîne (round-trip)', () => {
    const blob = encrypt('mon-mot-de-passe-campay');
    expect(blob).not.toBe('mon-mot-de-passe-campay');
    expect(isEncrypted(blob)).toBe(true);
    expect(decrypt(blob)).toBe('mon-mot-de-passe-campay');
  });

  it('produit un blob différent à chaque appel (IV aléatoire)', () => {
    expect(encrypt('x')).not.toBe(encrypt('x'));
  });

  it('renvoie null pour un blob non valide / non chiffré', () => {
    expect(decrypt('texte-en-clair')).toBeNull();
    expect(decrypt('')).toBeNull();
    expect(decrypt(null)).toBeNull();
  });

  it('chaîne vide → chaîne vide', () => {
    expect(encrypt('')).toBe('');
  });
});
