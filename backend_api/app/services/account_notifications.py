# app/services/account_notifications.py
"""
Cycle de vie d'un nouveau compte (client / thérapeute) :

  inscription  -> compte DÉSACTIVÉ + notification (détaillée) à tous les admins
  vérif. OTP   -> email « votre compte attend l'activation d'un administrateur »
  activation   -> email + notification à l'utilisateur avec les détails de l'activation
  refus (thér.)-> email + notification avec le motif (s'il est renseigné)

Aucune fonction ne lève d'exception : un échec d'email/notification ne doit jamais
faire échouer l'action principale. Les emails partent dans un thread d'arrière-plan.
"""
import html
import logging
import threading
from datetime import datetime
from typing import Any, Dict, Optional

from ..core.config import settings
from ..models.user import User
from .email_service import render_email, send_email
from .mg_time import fmt_mg, iso_utc
from .notification_service import send_admin_notification, send_notification

logger = logging.getLogger(__name__)

ROLE_LABELS = {"CLIENT": "Client", "THERAPIST": "Thérapeute", "ADMIN": "Administrateur"}


def role_label(role: Optional[str]) -> str:
    return ROLE_LABELS.get(str(role or "").upper(), str(role or "Utilisateur").title())


def _in_background(fn, *args, **kwargs) -> None:
    def runner():
        try:
            fn(*args, **kwargs)
        except Exception:  # noqa: BLE001
            logger.exception("Tâche d'arrière-plan échouée (%s)", getattr(fn, "__name__", fn))

    threading.Thread(target=runner, daemon=True).start()


def _e(value: Any) -> str:
    return html.escape(str(value if value not in (None, "") else "—"))


def _login_button() -> Optional[tuple]:
    url = (getattr(settings, "FRONTEND_URL", "") or "").strip()
    return ("Se connecter à Mada Bien-être", url) if url else None


def _email_layout(
    title: str,
    intro_html: str,
    rows: Dict[str, Any],
    footer_html: str = "",
    alert: bool = False,
    button: Optional[tuple] = None,
) -> str:
    """Email au thème vert Mada Bien-être (voir email_service.render_email)."""
    return render_email(
        title, intro_html, rows=rows, footer_html=footer_html, alert=alert, button=button
    )


def _profile_steps_html(user: User) -> str:
    """Consigne : se connecter puis compléter TOUT le profil (en français)."""
    if str(user.role).upper() == "THERAPIST":
        items = [
            "Photo de profil, nom et numéro de téléphone",
            "Adresse : choisissez votre position sur la carte",
            "Numéro CIN et photo (ou PDF) de votre CIN",
            "Certificat professionnel (photo ou PDF)",
            "Biographie, années d'expérience et spécialités",
            "Tarif de base et rayon d'intervention",
        ]
    else:
        items = [
            "Photo de profil, nom et numéro de téléphone",
            "Adresse : choisissez votre position sur la carte",
            "Toutes les autres informations vous concernant",
        ]
    lis = "".join(f"<li style='margin:3px 0'>{_e(i)}</li>" for i in items)
    return (
        "<p><strong>Pour commencer :</strong> connectez-vous à l'application avec votre adresse email "
        "et votre mot de passe, puis ouvrez la page <strong>« Profil »</strong> et "
        "<strong>renseignez soigneusement toutes vos informations</strong> :</p>"
        f"<ul style='padding-left:20px;margin:8px 0 14px'>{lis}</ul>"
        "<p>Un profil complet et exact facilite la validation de votre compte et améliore votre expérience.</p>"
    )


def _certificate_attachment(certificate: Any, db: Any) -> Optional[tuple]:
    """(nom, octets, mime) du PDF du certificat ; régénéré s'il a disparu du disque. None si impossible."""
    if certificate is None or db is None:
        return None
    try:
        from .certificate_service import ensure_certificate_pdf

        path = ensure_certificate_pdf(certificate, db)
        if not path:
            return None
        with open(path, "rb") as fh:
            data = fh.read()
        filename = f"Certificat_{certificate.certificate_number}.pdf"
        return filename, data, "application/pdf"
    except Exception:  # noqa: BLE001
        logger.exception("Certificat PDF illisible pour l'envoi par email")
        return None


def _account_rows(user: User) -> Dict[str, Any]:
    return {
        "Nom": user.fullname,
        "Email": user.email,
        "Téléphone": "" if str(user.phone or "").startswith("SOC") else user.phone,
        "Type de compte": role_label(user.role),
    }


# ------------------------------------------------------------
# 1. INSCRIPTION -> notification aux administrateurs
# ------------------------------------------------------------
def notify_admins_new_account(user: User, source: str = "email") -> int:
    """Notifie les admins qu'un nouveau compte attend une activation (avec ses informations)."""
    try:
        is_therapist = str(user.role).upper() == "THERAPIST"
        created = user.created_at or datetime.utcnow()
        phone = "" if str(user.phone or "").startswith("SOC") else user.phone
        via = {"google": "Google", "apple": "Apple"}.get(source)

        lines = [
            f"{role_label(user.role)} : {user.fullname} (ID #{user.id})",
            f"Email : {user.email}",
            f"Téléphone : {phone or 'non renseigné'}",
            f"Inscrit le : {fmt_mg(created)}",
            "Statut : en attente d'activation",
        ]
        if via:
            lines.append(f"Inscription via : {via} (email déjà vérifié)")
        else:
            lines.append("Vérification email : code OTP envoyé, en cours")
        if is_therapist:
            lines.append("Documents (CIN, certificat) à vérifier avant validation.")

        data = {
            "user_id": user.id,
            "role": str(user.role).upper(),
            "fullname": user.fullname,
            "email": user.email,
            "phone": phone,
            "created_at": iso_utc(created),
            "status": "pending_activation",
            "source": source,
            # Navigation : ApprovalDetailScreen (thérapeute) / UserDetailScreen (client)
            "target_screen": "ApprovalDetail" if is_therapist else "UserDetail",
            "target_params": {"therapistId": user.id} if is_therapist else {"userId": user.id},
        }
        if is_therapist:
            data["therapist_id"] = user.id

        return send_admin_notification(
            title="Nouveau thérapeute à valider" if is_therapist else "Nouveau client à activer",
            body="\n".join(lines),
            notification_type="therapist_application" if is_therapist else "new_user",
            data=data,
            priority="high",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification admin (nouveau compte) échouée user_id=%s", getattr(user, "id", None))
        return 0


# ------------------------------------------------------------
# 2. OTP vérifié -> « en attente d'activation »
# ------------------------------------------------------------
def send_pending_activation_email(user: User, source: str = "email") -> None:
    email, name = user.email, user.fullname
    rows = _account_rows(user)
    verified = "Votre adresse email a bien été vérifiée." if source == "email" else \
        "Votre compte a bien été créé et votre adresse email est vérifiée."
    body = _email_layout(
        "Votre compte est en attente d'activation",
        f"<p>Bonjour {_e(name)},</p>"
        f"<p>{verified}</p>"
        "<p><strong>Votre compte doit encore être activé par un administrateur</strong> "
        "avant que vous puissiez vous connecter à Mada Bien-être.</p>",
        rows,
        "<p>Vous recevrez un nouvel email dès que votre compte sera activé. "
        "Merci de votre patience.</p>",
    )
    text = (
        f"Bonjour {name},\n\n{verified}\n"
        "Votre compte doit encore être activé par un administrateur avant que vous puissiez "
        "vous connecter. Vous recevrez un email dès l'activation.\n\nMada Bien-être"
    )
    _in_background(send_email, email, "Mada Bien-être - Compte en attente d'activation", body, text)


# ------------------------------------------------------------
# 3. ACTIVATION par l'admin -> email + notification
# ------------------------------------------------------------
def notify_account_activated(
    user: User,
    admin: Optional[User] = None,
    certificate_number: Optional[str] = None,
    notification_type: str = "account_activated",
    certificate: Any = None,
    db: Any = None,
) -> None:
    when = fmt_mg(datetime.utcnow())
    admin_name = getattr(admin, "fullname", None) or "Un administrateur"
    is_therapist = str(user.role).upper() == "THERAPIST"

    if certificate is not None and not certificate_number:
        certificate_number = getattr(certificate, "certificate_number", None)
    # Certificat PDF joint directement à l'email (thérapeute approuvé)
    attachment = _certificate_attachment(certificate, db) if is_therapist else None

    rows = _account_rows(user)
    rows["Activé le"] = when
    rows["Activé par"] = admin_name
    if is_therapist:
        rows["Validation du profil"] = "Approuvé"
        if certificate_number:
            rows["N° de certificat"] = certificate_number

    # --- email (arrière-plan) ---
    if attachment:
        title = "Félicitations, votre compte est approuvé"
        footer = (
            "<p>&#128206; <strong>Votre certificat officiel est joint à cet email (PDF).</strong> "
            "Conservez-le : il atteste de la validation de votre profil par Mada Bien-être. "
            "Il reste aussi disponible dans votre profil sur l'application.</p>"
            + _profile_steps_html(user)
            + "<p>Une fois votre profil complété, passez « En ligne » pour recevoir vos premières demandes.</p>"
        )
        subject = "Mada Bien-être - Compte approuvé : votre certificat est en pièce jointe"
    else:
        title = "Votre compte a été activé"
        footer = _profile_steps_html(user)
        subject = "Mada Bien-être - Votre compte a été activé"
    body = _email_layout(
        title,
        f"<p>Bonjour {_e(user.fullname)},</p>"
        "<p>Bonne nouvelle : <strong>votre compte Mada Bien-être a été activé</strong>. "
        "Vous pouvez dès maintenant vous connecter.</p>",
        rows,
        footer,
        button=_login_button(),
    )
    text = (
        f"Bonjour {user.fullname},\n\nVotre compte Mada Bien-être a été activé le {when} "
        f"par {admin_name}. Vous pouvez dès maintenant vous connecter."
        + ("\n\nVotre certificat officiel (PDF) est joint à cet email." if attachment else "")
        + "\n\nConnectez-vous à l'application avec votre adresse email et votre mot de passe, puis "
        "ouvrez la page « Profil » et renseignez soigneusement toutes vos informations "
        "(adresse, photo, téléphone"
        + (", CIN, certificat professionnel, biographie, spécialités, tarif" if is_therapist else "")
        + ").\n\nMada Bien-être"
    )
    _in_background(
        send_email, user.email, subject, body, text,
        attachments=[attachment] if attachment else None,
    )

    # --- notification dans l'application ---
    try:
        msg = f"Votre compte a été activé le {when} par {admin_name}."
        if is_therapist:
            msg = "Votre compte thérapeute a été validé. " + msg
            if certificate_number:
                msg += " Votre certificat est disponible dans votre profil."
        send_notification(
            user_id=user.id,
            title="Compte activé" if not is_therapist else "Compte approuvé",
            body=msg,
            notification_type=notification_type,
            data={
                "user_id": user.id,
                "therapist_id": user.id if is_therapist else None,
                "certificate_number": certificate_number,
                "activated_at": iso_utc(datetime.utcnow()),
                "activated_by": admin_name,
                "target_screen": "Profile",
            },
            priority="high",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification d'activation échouée user_id=%s", user.id)


# ------------------------------------------------------------
# 4. REFUS d'un thérapeute -> email + notification (+ motif)
# ------------------------------------------------------------
def notify_therapist_rejected(user: User, admin: Optional[User] = None, reason: Optional[str] = None) -> None:
    reason = (reason or "").strip()
    when = fmt_mg(datetime.utcnow())

    rows = _account_rows(user)
    rows["Décision le"] = when
    rows["Validation du profil"] = "Non validé"
    if reason:
        rows["Motif"] = reason

    body = _email_layout(
        "Votre compte n'a pas été validé",
        f"<p>Bonjour {_e(user.fullname)},</p>"
        "<p>Après vérification de votre dossier, <strong>votre compte thérapeute n'a pas été validé</strong>.</p>",
        rows,
        "<p>Vous pouvez compléter votre profil et vos documents depuis l'application, "
        "ou contacter l'équipe Mada Bien-être pour plus d'informations.</p>",
    )
    text = (
        f"Bonjour {user.fullname},\n\nVotre compte thérapeute n'a pas été validé."
        + (f"\nMotif : {reason}" if reason else "")
        + "\n\nMada Bien-être"
    )
    _in_background(send_email, user.email, "Mada Bien-être - Votre compte n'a pas été validé", body, text)

    try:
        msg = "Votre compte thérapeute n'a pas été validé."
        if reason:
            msg += f" Motif : {reason}"
        send_notification(
            user_id=user.id,
            title="Compte non validé",
            body=msg,
            notification_type="therapist_rejected",
            data={
                "user_id": user.id,
                "therapist_id": user.id,
                "reason": reason or None,
                "rejected_at": iso_utc(datetime.utcnow()),
                "target_screen": "Profile",
            },
            priority="high",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification de refus échouée user_id=%s", user.id)



# ------------------------------------------------------------
# 5. DÉSACTIVATION par l'admin -> email + notification
# ------------------------------------------------------------
def notify_account_deactivated(
    user: User, admin: Optional[User] = None, reason: Optional[str] = None
) -> None:
    reason = (reason or "").strip()
    when = fmt_mg(datetime.utcnow())
    admin_name = getattr(admin, "fullname", None) or "Un administrateur"

    rows = _account_rows(user)
    rows["Désactivé le"] = when
    rows["Désactivé par"] = admin_name
    rows["Statut du compte"] = "Désactivé"
    if reason:
        rows["Motif"] = reason

    body = _email_layout(
        "Votre compte a été désactivé",
        f"<p>Bonjour {_e(user.fullname)},</p>"
        "<p>Nous vous informons que <strong>votre compte Mada Bien-être a été désactivé</strong> "
        "par un administrateur. Vous ne pouvez plus vous connecter pour le moment.</p>",
        rows,
        "<p>Si vous pensez qu'il s'agit d'une erreur, ou pour toute question, "
        "contactez l'équipe Mada Bien-être.</p>",
        alert=True,
    )
    text = (
        f"Bonjour {user.fullname},\n\nVotre compte Mada Bien-être a été désactivé le {when} par {admin_name}."
        + (f"\nMotif : {reason}" if reason else "")
        + "\n\nPour toute question, contactez l'équipe Mada Bien-être.\n\nMada Bien-être"
    )
    _in_background(send_email, user.email, "Mada Bien-être - Votre compte a été désactivé", body, text)

    try:
        msg = f"Votre compte a été désactivé le {when} par {admin_name}."
        if reason:
            msg += f" Motif : {reason}"
        send_notification(
            user_id=user.id,
            title="Compte désactivé",
            body=msg,
            notification_type="account_deactivated",
            data={
                "user_id": user.id,
                "reason": reason or None,
                "deactivated_at": iso_utc(datetime.utcnow()),
                "deactivated_by": admin_name,
            },
            priority="high",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification de désactivation échouée user_id=%s", user.id)


# ------------------------------------------------------------
# 6. MODIFICATION par l'admin -> email + notification
# ------------------------------------------------------------
def notify_account_updated(
    user: User,
    admin: Optional[User] = None,
    changes: Optional[list] = None,
    previous_email: Optional[str] = None,
    in_app: bool = True,
) -> None:
    """`changes` : liste de (libellé, ancienne valeur, nouvelle valeur)."""
    if not changes:
        return
    when = fmt_mg(datetime.utcnow())
    admin_name = getattr(admin, "fullname", None) or "Un administrateur"

    rows: Dict[str, Any] = {}
    for label, old, new in changes:
        old_txt = "—" if old in (None, "") else str(old)
        new_txt = "—" if new in (None, "") else str(new)
        rows[label] = f"{old_txt}  →  {new_txt}"
    rows["Modifié le"] = when
    rows["Modifié par"] = admin_name

    body = _email_layout(
        "Votre compte a été modifié",
        f"<p>Bonjour {_e(user.fullname)},</p>"
        "<p>Un administrateur a <strong>modifié les informations de votre compte</strong> Mada Bien-être. "
        "Voici le détail (ancienne valeur → nouvelle valeur) :</p>",
        rows,
        "<p>Vérifiez ces informations dans la page « Profil » de l'application. "
        "Si vous n'êtes pas à l'origine de cette demande ou si quelque chose est incorrect, "
        "contactez l'équipe Mada Bien-être.</p>",
    )
    lines = "\n".join(f"- {k} : {v}" for k, v in rows.items())
    text = (
        f"Bonjour {user.fullname},\n\nUn administrateur a modifié votre compte Mada Bien-être :\n"
        f"{lines}\n\nMada Bien-être"
    )
    subject = "Mada Bien-être - Votre compte a été modifié"
    recipients = [user.email]
    if previous_email and previous_email.strip().lower() != (user.email or "").strip().lower():
        recipients.append(previous_email)  # l'ancienne adresse est aussi prévenue
    for to in recipients:
        _in_background(send_email, to, subject, body, text)

    if not in_app:
        return
    try:
        send_notification(
            user_id=user.id,
            title="Compte modifié",
            body="Un administrateur a modifié : " + ", ".join(c[0] for c in changes) + ".",
            notification_type="profile_updated",
            data={
                "user_id": user.id,
                "fields": [c[0] for c in changes],
                "updated_at": iso_utc(datetime.utcnow()),
                "target_screen": "Profile",
            },
            priority="normal",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification de modification échouée user_id=%s", user.id)


# ------------------------------------------------------------
# 7. RÉINITIALISATION du mot de passe par l'admin -> email
# ------------------------------------------------------------
def notify_password_reset(user: User, new_password: str, admin: Optional[User] = None) -> None:
    when = fmt_mg(datetime.utcnow())
    admin_name = getattr(admin, "fullname", None) or "Un administrateur"

    rows = {
        "Email de connexion": user.email,
        "Nouveau mot de passe": new_password,
        "Réinitialisé le": when,
        "Réinitialisé par": admin_name,
    }
    body = _email_layout(
        "Votre mot de passe a été réinitialisé",
        f"<p>Bonjour {_e(user.fullname)},</p>"
        "<p>Un administrateur a <strong>réinitialisé le mot de passe</strong> de votre compte Mada Bien-être. "
        "Utilisez les identifiants ci-dessous pour vous connecter :</p>",
        rows,
        "<p><strong>Pour votre sécurité, changez ce mot de passe dès votre prochaine connexion</strong> "
        "(Profil &rarr; Paramètres) et ne le partagez avec personne.</p>",
        button=_login_button(),
    )
    text = (
        f"Bonjour {user.fullname},\n\nUn administrateur a réinitialisé le mot de passe de votre compte "
        f"Mada Bien-être.\n\nEmail : {user.email}\nNouveau mot de passe : {new_password}\n\n"
        "Pour votre sécurité, changez ce mot de passe dès votre prochaine connexion.\n\nMada Bien-être"
    )
    _in_background(send_email, user.email, "Mada Bien-être - Votre mot de passe a été réinitialisé", body, text)

    try:
        send_notification(
            user_id=user.id,
            title="Mot de passe réinitialisé",
            body="Un administrateur a réinitialisé votre mot de passe. Le nouveau mot de passe vous a été envoyé par email.",
            notification_type="password_reset",
            data={"user_id": user.id, "reset_at": iso_utc(datetime.utcnow())},
            priority="high",
        )
    except Exception:  # noqa: BLE001
        logger.exception("Notification de réinitialisation échouée user_id=%s", user.id)


# ------------------------------------------------------------
# 8. CRÉATION d'un compte par l'admin -> email avec TOUTES les infos
# ------------------------------------------------------------
def notify_account_created_by_admin(
    user: User, password: str, admin: Optional[User] = None
) -> None:
    when = fmt_mg(datetime.utcnow())
    admin_name = getattr(admin, "fullname", None) or "Un administrateur"

    rows = _account_rows(user)
    rows["Mot de passe"] = password
    rows["Statut du compte"] = "Actif"
    rows["Créé le"] = when
    rows["Créé par"] = admin_name

    body = _email_layout(
        "Votre compte a été créé",
        f"<p>Bonjour {_e(user.fullname)},</p>"
        f"<p>Un administrateur a <strong>créé votre compte {_e(role_label(user.role))}</strong> sur Mada Bien-être. "
        "Voici toutes les informations de votre compte, avec vos identifiants de connexion :</p>",
        rows,
        _profile_steps_html(user)
        + "<p><strong>Pour votre sécurité, changez votre mot de passe dès votre première connexion.</strong></p>",
        button=_login_button(),
    )
    text = (
        f"Bonjour {user.fullname},\n\nUn administrateur a créé votre compte {role_label(user.role)} "
        f"sur Mada Bien-être.\n\nNom : {user.fullname}\nEmail : {user.email}\n"
        f"Téléphone : {user.phone}\nType de compte : {role_label(user.role)}\n"
        f"Mot de passe : {password}\n\nConnectez-vous, ouvrez la page « Profil » et renseignez toutes vos "
        "informations. Changez votre mot de passe dès la première connexion.\n\nMada Bien-être"
    )
    _in_background(send_email, user.email, "Mada Bien-être - Votre compte a été créé", body, text)
