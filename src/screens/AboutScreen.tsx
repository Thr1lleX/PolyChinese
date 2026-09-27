import { useCatalog } from '../data/CatalogContext';

export function AboutScreen() {
  const { meta } = useCatalog();
  return (
    <div className="screen prose">
      <h1>À propos</h1>
      <p>
        PolyChinese est un outil personnel d'apprentissage du chinois. Il fonctionne hors ligne et vos données restent sur
        votre appareil.
      </p>
      <p className="muted">
        Données du {meta.version} : {meta.chars.toLocaleString('fr')} caractères, {meta.words.toLocaleString('fr')} mots.
      </p>

      <h2>Sources et licences</h2>
      <ul>
        <li>
          <strong>Traductions françaises</strong> :{' '}
          <a href="https://chine.in/mandarin/dictionnaire/CFDICT/">CFDICT</a>, dictionnaire chinois-français libre de{' '}
          <a href="https://chine.in">Chine Informations</a>, sous licence{' '}
          <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.fr">CC BY-SA 3.0</a>.
        </li>
        <li>
          <strong>Traductions anglaises (secours)</strong> :{' '}
          <a href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict">CC-CEDICT</a>, sous licence{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr">CC BY-SA 4.0</a>.
        </li>
        <li>
          <strong>Ordre des traits et décomposition</strong> :{' '}
          <a href="https://github.com/skishore/makemeahanzi">Make Me a Hanzi</a> (tracés sous Arphic Public License,
          dictionnaire sous LGPL) et <a href="https://hanziwriter.org">Hanzi Writer</a> (MIT).
        </li>
        <li>
          <strong>Listes HSK</strong> :{' '}
          <a href="https://github.com/drkameleon/complete-hsk-vocabulary">complete-hsk-vocabulary</a> (MIT).
        </li>
        <li>
          <strong>Fréquences</strong> : SUBTLEX-CH, Cai &amp; Brysbaert (2010),{' '}
          <a href="https://doi.org/10.1371/journal.pone.0010729">PLOS ONE 5(6): e10729</a>, sous licence CC BY.
        </li>
      </ul>
      <p className="muted">
        Les données dictionnaire dérivées de CFDICT et CC-CEDICT sont redistribuées sous la même licence (CC BY-SA).
      </p>
    </div>
  );
}
