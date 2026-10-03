-- Complète clientele_type (ajouté en 024 pour Ophtalmologie seule) pour les 20 autres spécialités,
-- même principe : description générale et factuelle de la patientèle et du champ d'exercice type de
-- chaque spécialité (pas une donnée propre à un dossier), pour pré-remplir la section "La Clientèle"
-- du business plan (Partie IV, Étude Commerciale). Reste éditable dans tous les cas.

UPDATE specialites SET clientele_type =
'Patientèle indirecte : échantillons biologiques (biopsies, pièces opératoires, prélèvements cytologiques) adressés par les médecins traitants, chirurgiens et autres spécialistes pour examen histologique et cytologique, en vue du diagnostic de pathologies tumorales et non tumorales.

Le laboratoire assure la lecture des lames, l''élaboration des comptes rendus anatomopathologiques et, le cas échéant, des examens complémentaires (immunohistochimie, biologie moléculaire) à la demande des cliniciens référents.'
WHERE id = 'Anatomopathologie';

UPDATE specialites SET clientele_type =
'Patientèle adulte présentant une pathologie cardiovasculaire avérée ou suspectée : hypertension artérielle, maladie coronarienne, troubles du rythme, insuffisance cardiaque, valvulopathies, ainsi que les patients adressés pour un bilan préopératoire ou un suivi des facteurs de risque cardiovasculaire (diabète, dyslipidémie, tabagisme).

Le cabinet assure la consultation, les explorations non invasives (ECG, échocardiographie, épreuve d''effort, Holter), la prise en charge thérapeutique et le suivi au long cours des patients chroniques.'
WHERE id = 'Cardiologie';

UPDATE specialites SET clientele_type =
'Patientèle pluridisciplinaire de tous âges nécessitant une prise en charge médicale ou chirurgicale, programmée ou urgente, couvrant plusieurs spécialités selon l''offre de soins de l''établissement (médecine, chirurgie, maternité, imagerie, urgences).

La patientèle inclut aussi bien des consultations externes que des hospitalisations de courte, moyenne ou longue durée.'
WHERE id = 'Clinique';

UPDATE specialites SET clientele_type =
'Patientèle de tous âges nécessitant des soins dentaires préventifs, conservateurs ou chirurgicaux : caries, pathologies parodontales, troubles de l''occlusion, besoins esthétiques ou prothétiques.

Le cabinet assure les soins courants (détartrage, obturations, extractions), l''orthodontie, la prothèse dentaire ainsi que, selon le plateau technique, des actes de chirurgie buccale et d''implantologie.'
WHERE id = 'Dentisterie';

UPDATE specialites SET clientele_type =
'Patientèle de tous âges consultant pour des affections de la peau, des muqueuses et des phanères (cheveux, ongles), ainsi que pour des demandes de médecine esthétique : dermatoses inflammatoires et infectieuses, pathologies tumorales cutanées (dépistage et suivi des grains de beauté), épilation laser, injections et peeling.

Le cabinet assure le diagnostic, le traitement médical et, selon l''équipement, les actes de dermatologie interventionnelle et esthétique.'
WHERE id = 'Dermatologie';

UPDATE specialites SET clientele_type =
'Patientèle adulte et pédiatrique présentant un trouble hormonal ou métabolique : diabète, pathologies thyroïdiennes, troubles de la croissance, obésité, troubles de la fertilité d''origine hormonale, pathologies surrénaliennes et hypophysaires.

Le cabinet assure le diagnostic, l''équilibration thérapeutique et le suivi au long cours de ces pathologies chroniques, en coordination avec les autres spécialités si besoin.'
WHERE id = 'Endocrinologie';

UPDATE specialites SET clientele_type =
'Patientèle présentant des troubles digestifs aigus ou chroniques : pathologies œsogastroduodénales, troubles intestinaux (maladies inflammatoires chroniques, syndrome de l''intestin irritable), pathologies hépatiques et biliaires, ainsi que les patients adressés pour un dépistage (notamment colorectal).

Le cabinet assure la consultation, les explorations endoscopiques (gastroscopie, coloscopie) et le suivi thérapeutique des pathologies digestives chroniques.'
WHERE id = 'Gastroenterologie';

UPDATE specialites SET clientele_type =
'Patientèle féminine de tous âges, pour le suivi gynécologique de routine (dépistage, contraception, ménopause), la prise en charge de pathologies gynécologiques, ainsi que le suivi de grossesse et l''accouchement.

Le cabinet assure les consultations de gynécologie, l''échographie, le suivi prénatal et, selon le plateau technique, les actes de chirurgie gynécologique.'
WHERE id = 'Gynecologie';

UPDATE specialites SET clientele_type =
'Patientèle de tous âges nécessitant une rééducation fonctionnelle : suites de traumatismes ou de chirurgie orthopédique, pathologies rhumatologiques et neurologiques, troubles musculo-squelettiques, ainsi que les patients adressés pour une rééducation respiratoire ou périnéale.

Le cabinet assure des séances de kinésithérapie individualisées sur prescription médicale, adaptées au type de pathologie et à l''évolution du patient.'
WHERE id = 'Kinesitherapie';

UPDATE specialites SET clientele_type =
'Patientèle directe (prélèvements sur place) et indirecte (échantillons adressés par les médecins prescripteurs) nécessitant des analyses biologiques à visée diagnostique ou de suivi : biochimie, hématologie, microbiologie, sérologie et autres examens spécialisés.

Le laboratoire assure le prélèvement, l''analyse et la transmission des résultats aux patients et aux médecins prescripteurs.'
WHERE id = 'LaboratoireAnalyses';

UPDATE specialites SET clientele_type =
'Patientèle de tous âges pour le suivi médical courant, la prévention, le dépistage et la prise en charge de premier recours des pathologies aiguës et chroniques.

Le cabinet assure les consultations générales, le suivi des maladies chroniques (diabète, hypertension...), la vaccination, et oriente si nécessaire vers les spécialistes concernés.'
WHERE id = 'MedecineGenerale';

UPDATE specialites SET clientele_type =
'Patientèle présentant une pathologie rénale aiguë ou chronique : insuffisance rénale à différents stades, hypertension artérielle d''origine rénale, troubles hydro-électrolytiques, ainsi que les patients nécessitant une préparation ou un suivi de dialyse ou de transplantation rénale.

Le cabinet assure le diagnostic, le suivi néphrologique au long cours et la coordination avec les autres intervenants (diététicien, chirurgien transplanteur, centre de dialyse).'
WHERE id = 'Nephrologie';

UPDATE specialites SET clientele_type =
'Patientèle présentant des troubles du système nerveux central ou périphérique : céphalées et migraines, épilepsie, accidents vasculaires cérébraux, maladies neurodégénératives (Parkinson, démences), neuropathies et troubles du mouvement.

Le cabinet assure la consultation, les explorations neurologiques selon le plateau technique, et le suivi thérapeutique au long cours des pathologies chroniques.'
WHERE id = 'Neurologie';

UPDATE specialites SET clientele_type =
'Patientèle de tous âges présentant une pathologie de l''oreille, du nez, de la gorge ou des voies aérodigestives supérieures : troubles auditifs, infections ORL récidivantes, troubles de l''équilibre, pathologies du ronflement, ainsi que les pathologies tumorales de la sphère ORL.

Le cabinet assure la consultation, les explorations fonctionnelles (audiométrie...) et, selon le plateau technique, les interventions chirurgicales courantes.'
WHERE id = 'ORL';

UPDATE specialites SET clientele_type =
'Patientèle présentant un cancer avéré ou en cours de dépistage, nécessitant une prise en charge diagnostique, thérapeutique (chimiothérapie, thérapies ciblées) ou un suivi post-traitement.

Le cabinet assure la consultation, la coordination du parcours de soins avec les autres intervenants (chirurgien, radiothérapeute) et le suivi au long cours des patients en rémission.'
WHERE id = 'Oncologie';

UPDATE specialites SET clientele_type =
'Patientèle de tous âges présentant une pathologie de l''appareil locomoteur : traumatismes (fractures, entorses, luxations), pathologies dégénératives (arthrose), troubles rachidiens et besoins de chirurgie orthopédique programmée (prothèses, ligamentoplastie).

Le cabinet assure la consultation, le diagnostic, la prise en charge médicale et, selon le plateau technique, les interventions chirurgicales et le suivi postopératoire.'
WHERE id = 'Orthopedie';

UPDATE specialites SET clientele_type =
'Patientèle d''enfants de la naissance à l''adolescence, pour le suivi de croissance et de développement, la vaccination, le dépistage et la prise en charge des pathologies aiguës et chroniques de l''enfant.

Le cabinet assure les consultations de suivi systématique, les soins courants, et oriente si nécessaire vers les spécialités pédiatriques concernées.'
WHERE id = 'Pediatrie';

UPDATE specialites SET clientele_type =
'Patientèle de tous âges présentant un trouble psychique : troubles anxieux et dépressifs, troubles bipolaires, troubles psychotiques, troubles du comportement ou de l''adaptation.

Le cabinet assure l''évaluation clinique, le diagnostic, la prise en charge thérapeutique (suivi, prescription) et, selon les besoins, oriente vers une prise en charge psychothérapeutique complémentaire.'
WHERE id = 'Psychiatrie';

UPDATE specialites SET clientele_type =
'Patientèle adressée par des médecins prescripteurs pour un examen d''imagerie à visée diagnostique ou de suivi : radiographie standard, échographie, scanner, IRM selon le plateau technique du centre.

Le centre assure la réalisation des examens, leur interprétation et la transmission des comptes rendus aux patients et aux médecins prescripteurs.'
WHERE id = 'Radiologie';

UPDATE specialites SET clientele_type =
'Patientèle, principalement masculine mais aussi féminine, présentant une pathologie de l''appareil urinaire ou génital : troubles urinaires, lithiase, pathologies de la prostate, troubles de la fertilité masculine et pathologies tumorales urologiques.

Le cabinet assure la consultation, les explorations fonctionnelles et, selon le plateau technique, les interventions chirurgicales courantes.'
WHERE id = 'Urologie';
