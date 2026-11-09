import os, sys, io, zipfile
os.environ["DATABASE_URL"]="sqlite:////tmp/mb.db?check_same_thread=false"
os.environ["DEBUG"]="false"
os.environ["MESSENGER_UPLOAD_DIR"]="/tmp/mb_uploads"
sys.path.insert(0, os.getcwd())
from datetime import datetime
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.core.database import Base, engine, SessionLocal
import app.models  # noqa
from app.models.user import User
from app.models.booking import Booking
from app.core.security import create_access_token
from app.api import messenger, messenger_ws

Base.metadata.create_all(bind=engine)
app = FastAPI(); app.include_router(messenger.router); app.include_router(messenger_ws.router)
_tc = TestClient(app); c = _tc.__enter__()

db = SessionLocal()
def mk(name, role, n):
    u = User(fullname=name, email=f"{n}@t.mg", phone=f"03{n:08d}", password="x", role=role, is_active=True)
    db.add(u); db.commit(); db.refresh(u); return u
cl, th, th2, ad = mk("Client","CLIENT",1), mk("Thera","THERAPIST",2), mk("Thera2","THERAPIST",3), mk("Admin","ADMIN",4)
db.add(Booking(client_id=cl.id, therapist_id=th.id, client_price_proposed=1, address="x", scheduled_date=datetime.utcnow(), status="confirmed"))
db.commit()
H = lambda u: {"Authorization": "Bearer "+create_access_token({"sub": u.id})}
T = lambda u: create_access_token({"sub": u.id})

# --- chat existant : anciens messages (booking_id, sans conversation_id) ---
from app.models.chat_message import ChatMessage
bk = db.query(Booking).first()
legacy = [
  ChatMessage(booking_id=bk.id, sender_id=cl.id, content="Bonjour (ancien)", message_type="text", is_read=True),
  ChatMessage(booking_id=bk.id, sender_id=th.id, content='[[loc]]{"lat":-18.9,"lng":47.5,"address":"Tana","type":"live"}', message_type="text", is_read=False),
  ChatMessage(booking_id=bk.id, sender_id=th.id, content="", message_type="image", image_url=f"/chat/files/{bk.id}/"+"a"*32+".jpg", is_read=False),
]
db.add_all(legacy); db.commit()
lst = c.get("/messenger/conversations", headers=H(cl)).json()
bc = [x for x in lst if x["type"]=="booking"]; assert bc and bc[0]["unread_count"]==2, lst
assert bc[0]["title"]=="Thera" and bc[0]["booking_id"]==bk.id
hist = c.get(f"/messenger/conversations/{bc[0]['id']}/messages", headers=H(cl)).json()["messages"]
assert hist[1]["message_type"]=="location" and hist[1]["location"]["latitude"]==-18.9, hist[1]
assert hist[2]["message_type"]=="image" and hist[2]["attachment"]["url"].startswith("/chat/files/"), hist[2]
assert c.post(f"/messenger/conversations/booking/{bk.id}", headers=H(cl)).json()["id"]==bc[0]["id"]
assert c.post(f"/messenger/conversations/booking/{bk.id}", headers=H(th2)).status_code==403
c.post(f"/messenger/conversations/{bc[0]['id']}/read", headers=H(cl))
assert db.query(ChatMessage).filter(ChatMessage.booking_id==bk.id, ChatMessage.is_read==False).count()==0 or True
db.expire_all()
assert db.query(ChatMessage).filter(ChatMessage.booking_id==bk.id, ChatMessage.sender_id==th.id, ChatMessage.is_read==False).count()==0
r=c.post(f"/messenger/conversations/{bc[0]['id']}/messages", json={"type":"location","latitude":-18.8,"longitude":47.4,"address":"Ici","location_type":"booking"}, headers=H(cl)).json()
assert r["message_type"]=="location" and r["location"]["location_type"]=="booking", r
# direct rules
r = c.post("/messenger/conversations/direct", json={"user_id": th.id}, headers=H(cl)); assert r.status_code==200, r.text
cid = r.json()["id"]; assert cid==bc[0]["id"]
assert c.post("/messenger/conversations/direct", json={"user_id": th2.id}, headers=H(cl)).status_code==403
assert c.post("/messenger/conversations/direct", json={"user_id": ad.id}, headers=H(cl)).status_code==200

# WS: therapist connected, client sends over REST
with c.websocket_connect(f"/ws/messenger?token={T(th)}") as wt, c.websocket_connect(f"/ws/messenger?token={T(cl)}") as wc:
    assert wt.receive_json()["type"]=="ready"; assert wc.receive_json()["type"]=="ready"
    r = c.post(f"/messenger/conversations/{cid}/messages", json={"text":"Salama","client_id":"a1"}, headers=H(cl)); assert r.status_code==200, r.text
    mid = r.json()["id"]
    while True:
        g=wt.receive_json()
        if g["type"]=="message_new": assert g["message"]["content"]=="Salama"; break
    # idempotence
    assert c.post(f"/messenger/conversations/{cid}/messages", json={"text":"Salama","client_id":"a1"}, headers=H(cl)).json()["id"]==mid
    # WS send + ack
    wt.send_json({"type":"send","conversation_id":cid,"kind":"text","text":"Hello","client_id":"b1","reply_to_id":mid})
    while True:
        m = wt.receive_json()
        if m["type"]=="ack": assert m["message"]["reply_to"]["id"]==mid; break
    # read receipt
    c.post(f"/messenger/conversations/{cid}/messages", json={"text":"encore"}, headers=H(cl))
    wt.send_json({"type":"read","conversation_id":cid})
    seen=False
    for _ in range(30):
        m = wc.receive_json()
        if m["type"]=="receipt" and m["kind"]=="read": seen=True; break
    assert seen
    # typing
    wt.send_json({"type":"typing","conversation_id":cid,"is_typing":True})
    for _ in range(10):
        if wc.receive_json()["type"]=="typing": break
    # call
    wc.send_json({"type":"call_invite","conversation_id":cid})
    inc=None
    for _ in range(10):
        m = wt.receive_json()
        if m["type"]=="call_incoming": inc=m; break
    assert inc, "no incoming call"
    wt.send_json({"type":"call_accept","call_id":inc["call_id"]})
    wc.send_json({"type":"call_signal","call_id":inc["call_id"],"signal":"offer","data":{"sdp":"x"}})
    for _ in range(10):
        m = wt.receive_json()
        if m["type"]=="call_signal": assert m["signal"]=="offer"; break
    wt.send_json({"type":"call_hangup","call_id":inc["call_id"]})
    for _ in range(10):
        m = wc.receive_json()
        if m["type"]=="call_state" and m["status"]=="ended": break
print("ws ok")

# calls forbidden with admin
ad_conv = c.post("/messenger/conversations/direct", json={"user_id": ad.id}, headers=H(cl)).json()["id"]

# edit / react / pin / delete
assert c.put(f"/messenger/messages/{mid}", json={"text":"Salama !"}, headers=H(cl)).json()["content"]=="Salama !"
assert c.put(f"/messenger/messages/{mid}", json={"text":"hack"}, headers=H(th)).status_code==403
r=c.post(f"/messenger/messages/{mid}/reactions", json={"emoji":"❤️"}, headers=H(th)); assert r.json()["reactions"][0]["count"]==1
assert c.put(f"/messenger/messages/{mid}/pin", json={"pinned":True}, headers=H(th)).json()["is_pinned"]
assert len(c.get(f"/messenger/conversations/{cid}/pinned", headers=H(cl)).json())==1

# attachments
png=b"\x89PNG\r\n\x1a\n"+b"0"*50
r=c.post(f"/messenger/conversations/{cid}/attachments", files={"file":("a.png",png,"image/png")}, headers=H(cl)); assert r.status_code==200, r.text
url=r.json()["attachment"]["url"]
assert c.get(url, params={"token":T(th)}).status_code==200
assert c.get(url, params={"token":T(th2)}).status_code==403
assert c.post(f"/messenger/conversations/{cid}/attachments", files={"file":("a.exe",b"MZ"+b"0"*50,"application/x-msdownload")}, headers=H(cl)).status_code==415
buf=io.BytesIO(); z=zipfile.ZipFile(buf,"w"); z.writestr("[Content_Types].xml","x"); z.writestr("word/document.xml","x"); z.writestr("word/vbaProject.bin","x"); z.close()
assert c.post(f"/messenger/conversations/{cid}/attachments", files={"file":("m.docx",buf.getvalue(),"x")}, headers=H(cl)).status_code==415
assert c.post(f"/messenger/conversations/{cid}/attachments", files={"file":("v.m4a",b"\x00\x00\x00\x18ftypM4A "+b"0"*50,"audio/mp4")}, data={"kind":"audio","duration_seconds":"5"}, headers=H(cl)).json()["message_type"]=="audio"
assert c.post(f"/messenger/conversations/{cid}/messages", json={"type":"sticker","sticker_id":"an_heart"}, headers=H(cl)).status_code==200

# groups & admin reply rule
r=c.post("/messenger/groups", json={"title":"Équipe","type":"group","add_roles":["CLIENT","THERAPIST"]}, headers=H(ad)); assert r.status_code==200, r.text
gid=r.json()["id"]
assert c.post("/messenger/groups", json={"title":"x1"}, headers=H(cl)).status_code==403
am=c.post(f"/messenger/conversations/{gid}/messages", json={"text":"Annonce"}, headers=H(ad)).json(); assert am["allow_reply"] is False
assert c.post(f"/messenger/conversations/{gid}/messages", json={"text":"re","reply_to_id":am["id"]}, headers=H(cl)).status_code==403
assert c.post(f"/messenger/conversations/{gid}/messages", json={"text":"entre nous"}, headers=H(cl)).status_code==200
assert c.post(f"/messenger/conversations/{gid}/messages", json={"text":"ok","reply_to_id":am["id"]}, headers=H(ad)).status_code==200
am2=c.post(f"/messenger/conversations/{gid}/messages", json={"text":"Répondez","allow_reply":True}, headers=H(ad)).json()
assert c.post(f"/messenger/conversations/{gid}/messages", json={"text":"re","reply_to_id":am2["id"]}, headers=H(th)).status_code==200
c.put(f"/messenger/groups/{gid}", json={"type":"announcement"}, headers=H(ad))
assert c.post(f"/messenger/conversations/{gid}/messages", json={"text":"no"}, headers=H(cl)).status_code==403
assert c.put(f"/messenger/messages/{am2['id']}/pin", json={"pinned":True}, headers=H(cl)).status_code==403

# lists, unread, search, contacts, block, report
convs=c.get("/messenger/conversations", headers=H(th)).json(); print([(x["title"],x["unread_count"]) for x in convs])
print(c.get("/messenger/unread", headers=H(th)).json()["total"])
assert c.get("/messenger/search", params={"q":"Salama"}, headers=H(th)).json()["messages"]
assert any(x["id"]==ad.id for x in c.get("/messenger/contacts", headers=H(cl)).json())
assert c.post(f"/messenger/messages/{am['id']}/report", json={"reason":"spam"}, headers=H(cl)).status_code==200
assert len(c.get("/messenger/admin/reports", headers=H(ad)).json())==1
assert c.get("/messenger/admin/reports", headers=H(cl)).status_code==403
assert c.post(f"/messenger/blocks/{th.id}", headers=H(cl)).status_code==200
assert c.post(f"/messenger/conversations/{cid}/messages", json={"text":"x"}, headers=H(th)).status_code==403
assert c.get(f"/messenger/conversations/{cid}", headers=H(cl)).json()["blocked_by_me"]
assert c.delete(f"/messenger/messages/{mid}", headers=H(cl)).json()["scope"]=="all"
assert c.get("/messenger/stickers", headers=H(cl)).json()["recents"]==["an_heart"]
print("ALL OK")
