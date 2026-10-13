"""Chatbot IA de Mada Bien-être : FAQ locale + IA (OpenRouter) avec historique."""

import json
import logging
import re
from difflib import get_close_matches
import unicodedata
import uuid
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Pattern, Tuple

from sqlalchemy.orm import Session

from ...core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "openai/gpt-4o-mini"
AI_MIN_WORDS = 7
MAX_HISTORY = 10
MAX_CONVERSATIONS = 500


# Mots et expressions courants en français/malgache, y compris quelques fautes
# de frappe fréquentes. Cette couche aide même lorsque la clé IA est absente.
TEXT_ALIASES = {
    "fanorana": "massage", "fanoràna": "massage", "masssage": "massage",
    "masage": "massage", "massge": "massage", "massaje": "massage",
    "mamandrika": "reserver", "hamandrika": "reserver", "famandrihana": "reservation",
    "famandrihako": "reservation", "réservation": "reservation", "resrvation": "reservation",
    "reseravation": "reservation", "reservera": "reserver", "reserver": "reserver",
    "ohatrinona": "combien", "vidiny": "prix", "sarany": "tarif",
    "fandoavana": "paiement", "handoa": "payer", "aloa": "payer",
    "mpanotra": "therapeute", "mpanotra": "therapeute", "mpitsabo": "therapeute",
    "mpanjifa": "client", "toerana": "localisation", "adiresy": "adresse",
    "fanafoanana": "annulation", "hanafoana": "annuler", "foana": "annuler",
    "olana": "probleme", "fanampiana": "support", "vonjy": "urgence",
    "marary": "douleur", "lamosina": "dos", "bevohoka": "enceinte",
    "reraka": "fatigue", "misaotra": "merci", "salama": "bonjour",
    "karazana": "types de", "ahoana": "comment", "aiza": "ou se trouve",
    "inona": "quel", "firy": "combien", "azafady": "svp", "fanorana": "massage",
    "theraputique": "therapeutique", "therapeuthique": "therapeutique",
    "therapeute": "therapeute", "therapeutes": "therapeutes",
    "relaxent": "relaxant", "relaxan": "relaxant", "relaxante": "relaxant",
    "reflexologie": "reflexologie", "reflexolgie": "reflexologie",
    "disponibilite": "disponible", "disponiblite": "disponible",
    "annullation": "annulation", "annulaton": "annulation",
    "paiment": "paiement", "payement": "paiement", "payeement": "paiement",
    "insciption": "inscription", "inscrption": "inscription",
    "motdepase": "motdepasse", "passeword": "motdepasse",
    "geolocalisaton": "geolocalisation", "localisaton": "localisation",
}

# Lexique limité aux termes métier : évite de déformer arbitrairement les phrases.
FUZZY_VOCABULARY = {
    "massage", "massages", "relaxant", "therapeutique", "sportif", "reflexologie",
    "prenatal", "shiatsu", "reservation", "reserver", "annulation", "annuler",
    "paiement", "payer", "prix", "tarif", "combien", "disponible", "disponibilite",
    "therapeute", "therapeutes", "masseur", "masseuse", "inscription", "compte",
    "connexion", "motdepasse", "localisation", "geolocalisation", "adresse", "urgence",
    "securite", "support", "douleur", "dos", "grossesse", "enceinte", "avis",
    "evaluation", "negocier", "negociation", "remboursement", "reclamation", "probleme",
    "mvola", "orange", "money", "airtel", "rendez", "vous", "types", "type",
}


def normalize(text: str) -> str:
    """Normalise accents, variantes courantes, fautes de frappe et espaces."""
    text = unicodedata.normalize("NFD", (text or "").lower())
    text = "".join(char for char in text if unicodedata.category(char) != "Mn")
    text = re.sub(r"[^a-z0-9' -]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    # Expressions anglaises fréquentes que certains utilisateurs peuvent saisir.
    text = re.sub(r"\bback pain\b|\bbackache\b", "douleur au dos", text)
    text = re.sub(r"\bbook a massage\b|\bmake a reservation\b", "comment reserver massage", text)
    text = re.sub(r"\bhow much\b|\bprice\b|\bcost\b", "combien prix", text)
    text = re.sub(r"\bpayment\b|\bpay\b", "paiement", text)

    # Remplacement des expressions malgaches courantes par leur concept métier.
    for source, target in sorted(TEXT_ALIASES.items(), key=lambda item: len(item[0]), reverse=True):
        text = re.sub(rf"\b{re.escape(source)}\b", target, text)

    corrected = []
    for token in text.split():
        # Ne corrige que les mots suffisamment longs et proches d'un terme métier.
        if len(token) >= 5 and token not in FUZZY_VOCABULARY:
            matches = get_close_matches(token, FUZZY_VOCABULARY, n=1, cutoff=0.82)
            if matches:
                token = matches[0]
        corrected.append(token)
    return " ".join(corrected)


# ---------------------------------------------------------------------------
# FAQ : règles ordonnées du plus précis au plus général.
# Les expressions sont évaluées sur le texte normalisé.
# IMPORTANT : adapter les tarifs, moyens de paiement et délais aux règles
# réellement activées dans votre application.
# ---------------------------------------------------------------------------

FAQ_RULES: List[Tuple[str, str, str, List[str]]] = [
    (
        "massage_comparison",
        r"\b(difference|differencier|compare\w*|comparaison)\b.*\b(relaxant\w*|therapeut\w*)\b|\b(relaxant\w*|therapeut\w*)\b.*\b(difference|differencier|compare\w*|comparaison)\b",
        "Le massage relaxant vise surtout la détente, la diminution du stress et le bien-être général. Le massage thérapeutique cible davantage certaines tensions musculaires et gênes physiques, avec des techniques adaptées à la personne. Le choix dépend de votre objectif et de votre état de santé. En cas de douleur persistante ou de problème médical, demandez conseil à un professionnel de santé.",
        ["Quels sont les types de massage ?", "Quels sont les tarifs ?"],
    ),
    (
        "massage_back_pain",
        r"\b(mal au dos|douleur\w* au dos|dos douloureux|back pain|backache|lombalg\w*|cervical\w*|tension\w* musculaire\w*)\b",
        "Un massage adapté peut parfois aider à détendre les muscles du dos, mais il ne permet pas de diagnostiquer la cause de la douleur. Décrivez vos besoins dans votre demande afin d'échanger avec le thérapeute avant de confirmer. Si la douleur est intense, récente, persistante ou accompagnée d'autres symptômes, consultez un professionnel de santé.",
        ["Quelle est la différence entre relaxant et thérapeutique ?", "Comment réserver un massage ?"],
    ),
    (
        "massage_prenatal",
        r"\b(prenatal|enceinte|grossesse|femme enceinte)\b",
        "Le massage prénatal est conçu pour le confort des femmes enceintes, mais il ne convient pas à toutes les situations. Avant de réserver, demandez l'avis de votre médecin ou sage-femme, surtout en cas de grossesse à risque, puis choisissez un thérapeute formé à cette pratique. Ne réservez pas un massage si un professionnel de santé vous l'a déconseillé.",
        ["Comment réserver ?", "Quels sont les tarifs ?"],
    ),
    (
        "massage_reflexology",
        r"\b(reflexologie|reflexologie plantaire|massage des pieds|pieds fatigues)\b",
        "La réflexologie consiste à exercer des pressions sur certaines zones des pieds ou des mains pour favoriser la détente. Elle ne remplace pas un diagnostic ni un traitement médical. Dans Mada Bien-être, précisez que vous souhaitez une séance de réflexologie lors de votre demande.",
        ["Quels sont les types de massage ?", "Comment réserver un massage ?"],
    ),
    (
        "massage_hot_stones",
        r"\b(pierres chaudes|stone massage|hot stone)\b",
        "Le massage aux pierres chaudes utilise des pierres chauffées pour procurer une sensation de chaleur et favoriser la relaxation. Il ne convient pas nécessairement à tout le monde, notamment en présence de certains problèmes de santé ou de sensibilité cutanée. Signalez vos besoins au thérapeute avant la séance.",
        ["Quels sont les tarifs ?", "Quels sont les types de massage ?"],
    ),
    (
        "massage_sport",
        r"\b(massage sportif|sportif|recuperation sportive|apres le sport|avant le sport)\b",
        "Le massage sportif est généralement choisi pour accompagner la préparation ou la récupération après un effort et pour détendre les muscles sollicités. Il doit être adapté à l'intensité de l'activité et à votre état physique. En cas de blessure ou de douleur aiguë, demandez d'abord un avis médical.",
        ["Quels sont les tarifs ?", "Comment réserver un massage ?"],
    ),
    (
        "massage_relaxing",
        r"\b(massage relaxant|relaxant|detente|stress|se detendre|relaxation)\b",
        "Le massage relaxant est principalement destiné à favoriser la détente, réduire le stress ressenti et améliorer la sensation de bien-être. Il est souvent choisi lorsqu'on souhaite se relaxer sans cibler une douleur précise. Indiquez la durée souhaitée et vos préférences lors de la demande.",
        ["Quelle est la différence entre relaxant et thérapeutique ?", "Quels sont les tarifs ?"],
    ),
    (
        "massage_therapeutic",
        r"\b(massage therapeutique|therapeutique|tensions musculaires|muscles tendus)\b",
        "Le massage thérapeutique cherche surtout à travailler certaines tensions musculaires ou gênes physiques à l'aide de techniques adaptées. Il ne remplace pas un diagnostic ou un traitement médical et n'est pas adapté à toutes les douleurs. Expliquez vos besoins au thérapeute et consultez un professionnel de santé si la douleur persiste.",
        ["Quelle est la différence entre relaxant et thérapeutique ?", "Comment réserver un massage ?"],
    ),
    (
        "massage_shiatsu",
        r"\b(shiatsu|massage japonais)\b",
        "Le shiatsu est une pratique d'origine japonaise qui utilise des pressions sur différentes zones du corps, généralement par-dessus des vêtements. Il est souvent recherché pour la détente et le bien-être. Indiquez cette préférence dans votre demande et vérifiez avec le praticien que cette technique vous convient.",
        ["Quels sont les types de massage ?", "Comment réserver un massage ?"],
    ),
    (
        "massage_types",
        r"\b(types? de massage|sortes? de massage|massages? proposes|quels massages|quel massage|massage disponible|massages disponibles|karazana massage|massage)\b",
        "Mada Bien-être peut proposer plusieurs pratiques selon les thérapeutes disponibles : massage relaxant, thérapeutique, sportif, réflexologie, prénatal, pierres chaudes ou shiatsu. La disponibilité de chaque pratique peut varier. Choisissez le type qui correspond à votre objectif, puis vérifiez les offres reçues avant de confirmer.",
        ["Quelle est la différence entre relaxant et thérapeutique ?", "Quels sont les tarifs ?"],
    ),
    (
        "cancellation",
        r"\b(annul\w*|annulation|reporter|report du rendez.?vous|modifier ma reservation|changer la date|deplacer le rendez.?vous)\b",
        "Pour gérer une réservation, ouvrez la rubrique « Réservations », sélectionnez le rendez-vous concerné et consultez les actions disponibles. Les conditions d'annulation affichées dans l'application font foi ; vérifiez-les avant de confirmer l'annulation. Si l'option n'apparaît pas ou si vous avez un problème, contactez le support.",
        ["Voir mes réservations", "Comment modifier un rendez-vous ?"],
    ),
    (
        "payment_mvola",
        r"\b(mvola|orange money|airtel money|mobile money|payer par telephone|paiement mobile)\b",
        "Pour payer par mobile money, vérifiez les moyens de paiement proposés au moment de la confirmation de votre réservation et suivez les instructions affichées. Ne communiquez jamais votre code secret ou votre code OTP à un thérapeute ou à une autre personne. Si MVola ou votre opérateur n'apparaît pas, contactez le support.",
        ["Quels sont les moyens de paiement ?", "Comment fonctionne le paiement ?"],
    ),
    (
        "payment",
        r"\b(paiement\w*|payer|paie\w*|reglement|carte bancaire|visa|mastercard|especes|vanila pay|moyens de paiement)\b",
        "Les moyens de paiement peuvent inclure MVola, Orange Money, Airtel Money, la carte bancaire ou les espèces, selon les options réellement disponibles dans l'application. Vérifiez les choix affichés au moment du paiement et conservez votre confirmation. Ne partagez jamais votre code secret ni votre code OTP.",
        ["Comment payer avec MVola ?", "Comment fonctionne une réservation ?"],
    ),
    (
        "price_specific",
        r"\b(prix|tarif\w*|cout|combien|vidiny|多少钱)\b.*\b(relaxant|therapeutique|sportif|reflexologie|prenatal|shiatsu|pierres chaudes)\b|\b(relaxant|therapeutique|sportif|reflexologie|prenatal|shiatsu|pierres chaudes)\b.*\b(prix|tarif\w*|cout|combien|vidiny)\b",
        "Le prix dépend du type de massage, de la durée, de la localisation et de l'offre du thérapeute. Consultez le montant proposé dans l'application et comparez les offres reçues avant d'accepter. Si la négociation est activée, vous pouvez discuter du prix dans le parcours de réservation.",
        ["Voir les tarifs", "Comment négocier une offre ?"],
    ),
    (
        "price",
        r"\b(prix|tarif\w*|couts?|combien|vidiny|budget)\b",
        "Le prix dépend notamment du type de massage, de sa durée et de l'offre du thérapeute. Les montants affichés dans l'application au moment de la demande et les offres reçues sont les références à utiliser. Si la négociation est proposée, vous pouvez échanger avec le thérapeute avant de confirmer.",
        ["Comment réserver un massage ?", "Comment négocier une offre ?"],
    ),
    (
        "availability",
        r"\b(disponib\w*|horaires?|creneaux?|libre aujourd'hui|disponible maintenant|pres de chez moi|près de chez moi)\b",
        "Consultez les thérapeutes et les disponibilités affichés dans l'application. Vous pouvez créer une demande avec le type de massage, la date, la durée et votre localisation ; les thérapeutes concernés pourront ensuite vous envoyer une offre. Les disponibilités peuvent changer, donc fiez-vous aux informations actualisées dans l'application.",
        ["Voir les thérapeutes disponibles", "Comment réserver un massage ?"],
    ),
    (
        "booking_steps",
        r"\b(comment|etapes?|procedure)\b.*\b(reserver|reservation|rendez.?vous|commander)\b|\b(reserver|reservation|rendez.?vous)\b.*\b(comment|etapes?|procedure)\b",
        "Pour réserver, ouvrez la rubrique de recherche ou de réservation, choisissez le type de massage, la durée, la date et le lieu, puis envoyez votre demande. Consultez les offres reçues, échangez sur le prix si la négociation est proposée, puis acceptez l'offre qui vous convient. Vérifiez les détails et le mode de paiement avant de confirmer.",
        ["Quels sont les tarifs ?", "Comment annuler une réservation ?"],
    ),
    (
        "booking",
        r"\b(reserv\w*|rendez.?vous|commander un massage|faire une demande de massage)\b",
        "Pour réserver un massage, créez une demande en précisant le type de massage, la durée, la date et le lieu. Consultez les offres des thérapeutes et vérifiez le prix, les détails et la disponibilité avant d'accepter une offre. Les étapes exactes et les moyens de paiement proposés sont ceux affichés dans l'application.",
        ["Quels sont les tarifs ?", "Comment annuler une réservation ?"],
    ),
    (
        "registration_problem",
        r"\b(probleme|erreur|bug|otp|code de verification|verification email|email non recu)\b.*\b(inscri\w*|compte|connexion|code|email)\b|\b(inscri\w*|compte|connexion)\b.*\b(probleme|erreur|bug|otp|email non recu)\b",
        "Vérifiez d'abord votre connexion Internet et l'exactitude de l'adresse e-mail ou du numéro saisi. Si un code de vérification est demandé, vérifiez vos messages et vos courriers indésirables, puis demandez un nouveau code si l'application le permet. Ne partagez pas votre code OTP ; si le problème continue, contactez le support avec le message d'erreur.",
        ["Comment créer un compte ?", "Contacter le support"],
    ),
    (
        "registration",
        r"\b(inscri\w*|creer un compte|creer mon compte|s'inscrire|inscription|ouvrir un compte)\b",
        "Pour créer un compte, ouvrez l'application Mada Bien-être, choisissez l'option d'inscription et remplissez les informations demandées. Suivez ensuite les étapes de vérification affichées à l'écran. Si vous souhaitez devenir thérapeute, utilisez le parcours professionnel et soumettez les documents demandés.",
        ["Comment devenir thérapeute ?", "J'ai un problème avec mon inscription"],
    ),
    (
        "become_therapist",
        r"\b(devenir|postuler|inscrire)\b.*\b(therapeute|masseur|masseuse|professionnel)\b|\b(therapeute|masseur|masseuse)\b.*\b(rejoindre|postuler|inscription)\b",
        "Pour proposer vos services, créez un compte puis choisissez le parcours destiné aux thérapeutes. Complétez votre profil et fournissez les pièces justificatives demandées, par exemple les documents d'identité et les justificatifs professionnels. Votre profil doit être validé avant de pouvoir utiliser les fonctionnalités professionnelles.",
        ["Quels documents fournir ?", "Comment fonctionne l'espace thérapeute ?"],
    ),
    (
        "therapist_verification",
        r"\b(verifi\w*|fiable\w*|securise\w*|diplomes?|certificats?|cin)\b.*\b(therapeute|masseur|masseuse|professionnel)\b|\b(therapeute|masseur|masseuse)\b.*\b(verifi\w*|fiable\w*|diplomes?|certificats?|cin)\b",
        "Consultez les informations et les éventuels badges de vérification visibles sur le profil du thérapeute. La plateforme peut demander des documents d'identité et des justificatifs professionnels, mais vous devez vous fier aux informations réellement affichées dans l'application. Avant la séance, échangez avec le thérapeute si vous avez une question sur son expérience ou sa pratique.",
        ["Comment devenir thérapeute ?", "Comment signaler un problème ?"],
    ),
    (
        "therapist",
        r"\b(therapeutes?|masseurs?|masseuses?|professionnels?)\b",
        "Vous pouvez consulter les profils des thérapeutes, leurs informations disponibles, leurs évaluations et les offres qu'ils vous envoient. Pour choisir, comparez la pratique proposée, la disponibilité, le prix et les informations du profil. Si vous souhaitez devenir thérapeute, utilisez le parcours professionnel de l'application.",
        ["Voir les thérapeutes disponibles", "Comment devenir thérapeute ?"],
    ),
    (
        "security_sos",
        r"\b(sos|urgence|danger|agression|agresse\w*|menace|securite|en securite)\b",
        "Si vous êtes en danger immédiat, contactez d'abord les services d'urgence locaux et mettez-vous dans un endroit sûr si possible. Si le bouton SOS est disponible dans votre application, utilisez-le selon les instructions affichées. Pour un problème lié à une réservation, contactez aussi le support de la plateforme dès que vous pouvez le faire en sécurité.",
        ["Comment signaler un problème ?", "Contacter le support"],
    ),
    (
        "complaint",
        r"\b(reclamation|plainte|signaler|mauvaise experience|probleme avec le therapeute|remboursement|arnaque)\b",
        "Si vous rencontrez un problème, conservez les détails de la réservation et les échanges utiles, puis contactez le support par le canal indiqué dans l'application. Décrivez les faits et joignez le message d'erreur ou les éléments pertinents. N'envoyez jamais votre mot de passe, code secret ou code OTP.",
        ["Contacter le support", "Comment annuler une réservation ?"],
    ),
    (
        "reviews",
        r"\b(avis|evaluation|note|commentaire|noter le therapeute|donner mon avis)\b",
        "Après la séance, ouvrez la réservation concernée et recherchez l'option d'évaluation si elle est disponible. Donnez une note honnête et décrivez votre expérience de façon respectueuse, sans publier d'informations personnelles sensibles. Si l'option n'apparaît pas, contactez le support.",
        ["Comment signaler un problème ?", "Voir mes réservations"],
    ),
    (
        "location",
        r"\b(localisation|geolocalisation|position|gps|adresse|itineraire|ou se trouve|distance)\b",
        "Vérifiez que la localisation est autorisée dans les paramètres de votre appareil et de votre navigateur, puis activez la localisation pour l'application si cette option est proposée. Sur ordinateur, la position peut être moins précise qu'avec un téléphone équipé d'un GPS. Vérifiez toujours l'adresse affichée avant de confirmer une réservation.",
        ["Comment réserver un massage ?", "Contacter le support"],
    ),
    (
        "account_login",
        r"\b(connexion|connecter|mot de passe|motdepasse|identifiant|me connecter|se connecter)\b",
        "Ouvrez l'écran de connexion et utilisez l'adresse e-mail ou l'identifiant associé à votre compte. Vérifiez que votre mot de passe est correctement saisi ; si vous l'avez oublié, utilisez la procédure de réinitialisation si elle est proposée. Ne communiquez jamais votre mot de passe ni votre code de vérification.",
        ["J'ai oublié mon mot de passe", "J'ai un problème avec mon inscription"],
    ),
    (
        "greeting",
        r"^(bonjour|bonsoir|salut|coucou|hello|salama|manao ahoana|manahoana)[!. ]*$",
        "Bonjour et bienvenue chez Mada Bien-être ! Je peux vous aider à choisir un massage, comprendre les tarifs, réserver, gérer une réservation ou obtenir des informations sur les thérapeutes. Que souhaitez-vous savoir ?",
        ["Quels sont les types de massage ?", "Comment réserver un massage ?"],
    ),
    (
        "thanks",
        r"\b(merci|misaotra|thanks)\b",
        "Avec plaisir ! Je suis là pour vous aider avec Mada Bien-être. Si vous avez une autre question sur les massages, les réservations ou les paiements, n'hésitez pas.",
        ["Quels sont les types de massage ?", "Comment réserver un massage ?"],
    ),
]

MALAGASY_RESPONSES = {
    "massage_comparison": "Ny massage relaxant dia natao indrindra hampiala sasatra sy hampihena ny adin-tsaina. Ny massage thérapeutique kosa dia mifantoka kokoa amin'ny fihenjanan'ny hozatra na ny tsy fahazoana aina ara-batana. Miankina amin'ny zavatra ilainao ny safidy. Raha mafy na maharitra ny fanaintainana dia manatona mpitsabo.",
    "massage_back_pain": "Ny massage mety amin'ny olona iray dia mety hanampy hampiala ny hozatry ny lamosina, saingy tsy afaka mamantatra ny anton'ny fanaintainana izy. Lazao amin'ny thérapeute ny olana mahazo anao alohan'ny hanekena ny séance. Raha mafy na maharitra ny fanaintainana dia manatona mpitsabo.",
    "massage_prenatal": "Ny massage prénatal dia natao hanampiana ny fampiononana ny vehivavy bevohoka, saingy tsy mety amin'ny toe-javatra rehetra. Mangataha torohevitra amin'ny dokotera na sage-femme aloha, indrindra raha grossesse à risque, ary mifidiana thérapeute efa niofana amin'izany.",
    "massage_reflexology": "Ny réflexologie dia mampiasa fanerena amin'ny faritra sasany amin'ny tongotra na tanana mba hanampiana ny fialan-tsasatra. Tsy misolo ny fitiliana na fitsaboana ara-pahasalamana izy. Lazao ao amin'ny fangatahanao fa réflexologie no tadiavinao.",
    "massage_hot_stones": "Ny massage aux pierres chaudes dia mampiasa vato mafana mba hanomezana hafanana sy hampiala sasatra. Tsy mety amin'ny olona rehetra izy, indrindra raha misy olana ara-pahasalamana na hoditra saro-pady. Ampahafantaro ny thérapeute ny toe-pahasalamanao alohan'ny séance.",
    "massage_sport": "Ny massage sportif dia mety hanampy amin'ny fanalefahana ny hozatra alohan'ny na aorian'ny fanatanjahan-tena. Tokony hifanaraka amin'ny ezaka sy ny toe-batanao izy. Raha misy ratra na fanaintainana tampoka dia mangataha torohevitra ara-pahasalamana aloha.",
    "massage_relaxing": "Ny massage relaxant dia natao indrindra hampiala sasatra, hampihena ny adin-tsaina ary hanatsara ny fahatsapana ho salama. Rehefa manao fangatahana ianao dia lazao ny faharetan'ny séance sy izay tianao.",
    "massage_therapeutic": "Ny massage thérapeutique dia mifantoka amin'ny fihenjanan'ny hozatra na ny tsy fahazoana aina ara-batana amin'ny alalan'ny teknika mifanaraka amin'ny olona. Tsy misolo dokotera izy. Hazavao amin'ny thérapeute ny zavatra tsapanao, ary manatona mpitsabo raha maharitra ny fanaintainana.",
    "massage_shiatsu": "Ny shiatsu dia teknika japoney mampiasa fanerena amin'ny faritra samihafa amin'ny vatana, matetika eo ambonin'ny akanjo. Lazao ao amin'ny fangatahanao raha shiatsu no tadiavinao ary hamarino amin'ny praticien fa mety aminao ilay teknika.",
    "massage_types": "Miankina amin'ny thérapeutes misy ao amin'ny Mada Bien-être, dia mety ahitana massage relaxant, thérapeutique, sportif, réflexologie, prénatal, pierres chaudes na shiatsu ny safidy. Mety hiova ny disponibilité. Safidio izay mifanaraka amin'ny filanao ary jereo ny offres alohan'ny hanekena.",
    "cancellation": "Raha hanafoana na hanova réservation ianao dia sokafy ny fizarana « Réservations », fidio ilay rendez-vous, ary jereo ny actions misy. Araho ny fepetra asehon'ny application. Raha tsy hitanao ny safidy dia mifandraisa amin'ny support.",
    "payment_mvola": "Raha handoa amin'ny mobile money ianao dia jereo ireo moyens de paiement aseho rehefa manamarina réservation, dia araho ny toromarika. Aza omena olona mihitsy ny code secret na OTP-nao. Raha tsy hita ao ny MVola dia mifandraisa amin'ny support.",
    "payment": "Miankina amin'ireo safidy tena asehon'ny application ny moyens de paiement. Jereo ny safidy rehefa mandoa ary tehirizo ny confirmation. Aza mizara code secret na OTP amin'olona.",
    "price_specific": "Miankina amin'ny karazana massage, faharetany, toerana ary offre avy amin'ny thérapeute ny vidiny. Jereo ny montant ao amin'ny application ary ampitahao ny offres alohan'ny hanekena.",
    "price": "Miankina amin'ny karazana massage, faharetany ary offre avy amin'ny thérapeute ny vidiny. Ny montant aseho ao amin'ny application sy ny offres voaray no tokony harahina. Raha misy négociation dia azonao ifampiresahana amin'ny thérapeute ny vidiny.",
    "availability": "Jereo ao amin'ny application ny thérapeutes sy ny disponibilités miseho. Azonao atao ny mamorona demande milaza ny karazana massage, daty, faharetana ary toerana. Mety hiova ny disponibilité, ka jereo hatrany ny vaovao farany.",
    "booking_steps": "Raha hamandrika massage: sokafy ny fikarohana na réservation, fidio ny karazana massage, faharetana, daty ary toerana, dia alefaso ny demande. Jereo ny offres voaray, ifampiresaho ny vidiny raha misy négociation, ary ekeo izay mety aminao rehefa voamarina ny antsipiriany.",
    "booking": "Mba hamandrika massage dia mamoròna demande ary fenoy ny karazana massage, faharetana, daty ary toerana. Jereo ny offres avy amin'ny thérapeutes ary hamarino ny vidiny sy ny disponibilité alohan'ny hanekena.",
    "registration_problem": "Hamarino aloha ny connexion Internet sy ny adiresy mailaka na laharana nampidirinao. Jereo koa ny spam raha miandry code ianao, ary mangataha code vaovao raha misy io safidy io. Aza mizara OTP. Raha mbola misy olana dia mifandraisa amin'ny support miaraka amin'ny hafatra diso.",
    "registration": "Raha hamorona compte dia sokafy ny Mada Bien-être, safidio ny inscription, ary fenoy ny vaovao angatahina. Araho ny dingana fanamarinana aseho. Raha te ho thérapeute ianao dia ampiasao ny parcours professionnel.",
    "become_therapist": "Raha te hanolotra tolotra ianao dia mamoròna compte, fidio ny parcours thérapeute, fenoy ny profil ary alefaso ny antontan-taratasy angatahina. Miankina amin'ny validation ny fahafahana mampiasa ny fonctionnalités professionnelles.",
    "therapist_verification": "Jereo ny mombamomba sy ny marika fanamarinana raha aseho ao amin'ny profil-n'ilay thérapeute. Mety hangataka antontan-taratasy ny plateforme, fa ny vaovao hita ao amin'ny application ihany no azo hamarinina. Afaka manontany ny thérapeute momba ny traikefany ianao alohan'ny séance.",
    "therapist": "Azonao jerena ny profil-n'ny thérapeutes, ny vaovao misy, ny avis ary ny offres alefany. Ampitahao ny karazana massage, disponibilité, vidiny ary ny mombamomba azy. Raha te ho thérapeute ianao dia ampiasao ny parcours professionnel.",
    "security_sos": "Raha tandindomin-doza avy hatrany ianao dia mifandraisa amin'ny sampana vonjy taitra eo an-toerana ary miezaha ho any amin'ny toerana azo antoka. Raha misy bouton SOS ao amin'ny application dia ampiasao araka ny toromarika. Ny fiarovana anao no laharam-pahamehana.",
    "complaint": "Raha misy olana dia tehirizo ny antsipirian'ny réservation sy ny fifampiresahana, dia mifandraisa amin'ny support amin'ny alalan'ny application. Hazavao ny zava-nitranga ary ampio ny hafatra diso raha misy. Aza mandefa mot de passe, code secret na OTP.",
    "reviews": "Aorian'ny séance dia sokafy ilay réservation ary tadiavo ny safidy hanomezana avis raha misy. Omeo naoty marina sy fanazavana am-panajana, ary aza mamoaka vaovao manokana saro-pady. Raha tsy miseho ilay safidy dia mifandraisa amin'ny support.",
    "location": "Hamarino fa navela ny localisation ao amin'ny réglages an'ny fitaovana sy navigateur. Amin'ny ordinatera dia mety tsy tena marina toy ny GPS amin'ny téléphone ny position. Hamarino tsara ny adiresy aseho alohan'ny hanamafisana réservation.",
    "account_login": "Sokafy ny écran connexion ary ampiasao ny mailaka na identifiant mifandray amin'ny compte-nao. Raha adino ny mot de passe dia ampiasao ny fomba réinitialisation raha misy. Aza mizara mot de passe na code de vérification.",
    "greeting": "Salama ary tongasoa eto amin'ny Mada Bien-être! Afaka manampy anao aho momba ny karazana massage, vidiny, réservation, paiement, fanafoanana na thérapeutes. Inona no tianao ho fantatra?",
    "thanks": "Tsy misy fisaorana! Eto aho hanampy anao momba ny Mada Bien-être. Afaka manontany momba ny massage, réservation na paiement ianao.",
}

MALAGASY_MARKERS = {"ahoana", "inona", "azafady", "misaotra", "salama", "karazana", "vidiny", "ohatrinona", "famandrihana", "fanorana", "mpanotra", "fandoavana", "aiza", "firy", "bevohoka", "olana", "mba", "ve", "afaka", "tsy", "raha", "misy"}


def _looks_malagasy(message: str) -> bool:
    raw = normalize(message)
    original = unicodedata.normalize("NFD", (message or "").lower())
    original = "".join(ch for ch in original if unicodedata.category(ch) != "Mn")
    tokens = set(re.findall(r"[a-z]+", original))
    return len(tokens & MALAGASY_MARKERS) >= 1


_COMPILED_RULES: List[Tuple[str, Pattern[str], str, List[str]]] = [
    (intent, re.compile(pattern), response, suggestions)
    for intent, pattern, response, suggestions in FAQ_RULES
]

DEFAULT_SUGGESTIONS = [
    "Quels sont les types de massage ?",
    "Quels sont les tarifs ?",
    "Comment réserver un massage ?",
    "Comment annuler une réservation ?",
]

SYSTEM_PROMPT = """Tu es l'assistant virtuel de Mada Bien-être, une plateforme de réservation de massages à domicile à Madagascar.
Réponds dans la langue de l'utilisateur : français par défaut, malgache si l'utilisateur écrit en malgache, et mélange français/malgache si la question mélange les deux. Comprends l'intention même en présence de fautes d'orthographe, de frappe, d'abréviations ou de formulations familières ; ne corrige pas l'utilisateur, réponds directement à ce qu'il veut savoir. Sois professionnel, clair, chaleureux et utile. Donne une réponse directe à la question, puis des étapes concrètes si nécessaire. Évite les réponses génériques qui ne répondent pas à la question précise.
N'invente jamais des fonctionnalités, des prix, des délais, des disponibilités, des garanties ou des moyens de paiement. Si une information dépend de l'application, invite l'utilisateur à vérifier ce qui est affiché dans l'application ou à contacter le support.
Informations générales : les utilisateurs peuvent demander des massages, consulter les offres de thérapeutes et, lorsque l'application le permet, négocier le prix. Les moyens de paiement et les conditions affichés dans l'application font foi.
Sécurité : ne demande jamais de mot de passe, code secret ou code OTP. En cas de danger immédiat, conseille de contacter les services d'urgence locaux. Tu ne poses pas de diagnostic et ne remplaces pas un professionnel de santé ; en cas de douleur sévère, persistante ou de grossesse à risque, conseille de demander un avis médical.
Garde les réponses concises mais suffisamment précises. Si tu ne connais pas la réponse, dis-le clairement et oriente vers le support."""

_history: "OrderedDict[str, List[Dict[str, str]]]" = OrderedDict()
_client = None


def _api_key() -> Optional[str]:
    value = getattr(settings, "OPENROUTER_API_KEY", None)
    return value.strip() if isinstance(value, str) and value.strip() else None


def _get_client():
    global _client
    if _client is None:
        from openai import AsyncOpenAI

        _client = AsyncOpenAI(
            api_key=_api_key(),
            base_url=getattr(settings, "OPENROUTER_BASE_URL", None) or DEFAULT_BASE_URL,
            timeout=25,
        )
    return _client


def _remember(conversation_id: str, role: str, content: str) -> None:
    """Ajoute un message à l'historique mémoire en limitant sa taille."""
    messages = _history.setdefault(conversation_id, [])
    messages.append({"role": role, "content": content})
    del messages[:-MAX_HISTORY]
    _history.move_to_end(conversation_id)
    while len(_history) > MAX_CONVERSATIONS:
        _history.popitem(last=False)


class ChatbotService:
    """Service de chatbot : FAQ ciblée et recours à l'IA si disponible."""

    def match_faq(self, message: str) -> Optional[Dict[str, Any]]:
        text = normalize(message)
        if not text:
            return None

        # Évaluer toutes les règles et privilégier les intentions spécifiques.
        # Cela évite qu'un mot général comme « thérapeute » masque une question
        # plus précise sur le prix, la réservation ou la sécurité.
        matches = []
        for index, (intent, regex, response, suggestions) in enumerate(_COMPILED_RULES):
            found = regex.search(text)
            if found:
                specificity = len(found.group(0).split())
                # Les règles plus précises ont la priorité ; l'ordre sert de départage.
                matches.append((specificity, -index, intent, response, suggestions))
        if not matches:
            return None
        specificity, _, intent, response, suggestions = max(matches, key=lambda item: (item[0], item[1]))
        if _looks_malagasy(message):
            response = MALAGASY_RESPONSES.get(intent, response)
        return {
            "response": response,
            "conversation_id": f"faq_{intent}",
            "intent": intent,
            "confidence": 0.91 if specificity >= 2 else 0.82,
            "suggestions": suggestions,
            "data": {},
        }

    async def get_response(
        self,
        message: str,
        user_id: Optional[int] = None,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        message = (message or "").strip()
        conv_id = conversation_id or f"chat_{user_id or 'anon'}_{uuid.uuid4().hex[:8]}"

        if not message:
            return self._default(conv_id, "Posez-moi votre question, je vous écoute !")

        faq = self.match_faq(message)
        ai_enabled = bool(_api_key())

        # Quand l'IA est configurée, elle traite toutes les questions, même courtes,
        # pour mieux comprendre les fautes, le contexte et les demandes variées.
        # La FAQ reste le secours si l'API est indisponible ou si elle échoue.
        if ai_enabled:
            ai_result = await self.get_ai_response(message, user_id, conv_id, context)
            if ai_result is not None:
                return ai_result

        # Sans IA, utiliser les réponses locales avec normalisation tolérante.
        if faq:
            result = dict(faq)
            result["conversation_id"] = conv_id
            _remember(conv_id, "user", message)
            _remember(conv_id, "assistant", result["response"])
            return result

        return self._default(conv_id)

    async def get_ai_response(
        self,
        message: str,
        user_id: Optional[int],
        conversation_id: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Appelle OpenRouter ; renvoie None si l'API est indisponible."""
        try:
            system = SYSTEM_PROMPT
            if context:
                safe_context = json.dumps(context, ensure_ascii=False, default=str)
                system += f"\nContexte utilisateur non sensible : {safe_context}"

            messages = [{"role": "system", "content": system}]
            messages.extend(_history.get(conversation_id, []))
            messages.append({"role": "user", "content": message})

            response = await _get_client().chat.completions.create(
                model=getattr(settings, "OPENROUTER_MODEL", None) or DEFAULT_MODEL,
                messages=messages,
                temperature=0.35,
                max_tokens=500,
            )
            answer = (response.choices[0].message.content or "").strip()
            if not answer:
                return None

            _remember(conversation_id, "user", message)
            _remember(conversation_id, "assistant", answer)
            return {
                "response": answer,
                "conversation_id": conversation_id,
                "intent": "ai_response",
                "confidence": 0.85,
                "suggestions": [
                    "Quels sont les types de massage ?",
                    "Quels sont les tarifs ?",
                    "Comment réserver un massage ?",
                ],
                "data": {},
            }
        except Exception as exc:  # noqa: BLE001
            logger.warning("Chatbot IA indisponible : %r", exc)
            return None

    @staticmethod
    def _default(conversation_id: str, text: Optional[str] = None) -> Dict[str, Any]:
        return {
            "response": text or (
                "Je n'ai pas bien compris votre demande. Vous pouvez écrire avec vos propres mots, même avec des fautes : je vais essayer de comprendre. "
                "Vous pouvez aussi demander les types de massage, les prix, une réservation, un paiement, l'annulation, la localisation ou l'aide du support Mada Bien-être."
            ),
            "conversation_id": conversation_id,
            "intent": "unknown",
            "confidence": 0.3,
            "suggestions": DEFAULT_SUGGESTIONS,
            "data": {},
        }


_service = ChatbotService()


async def get_chatbot_response(
    message: str,
    user_id: Optional[int] = None,
    conversation_id: Optional[str] = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Point d'entrée utilisé par les routers /chatbot et /ai."""
    context: Dict[str, Any] = {}
    if db is not None and user_id:
        try:
            from ...models.user import User

            user = db.query(User).filter(User.id == user_id).first()
            if user:
                context = {
                    "fullname": getattr(user, "fullname", None),
                    "role": getattr(user, "role", None),
                }
        except Exception:  # noqa: BLE001
            logger.debug("Contexte utilisateur indisponible", exc_info=True)

    return await _service.get_response(
        message=message,
        user_id=user_id,
        conversation_id=conversation_id,
        context=context or None,
    )
