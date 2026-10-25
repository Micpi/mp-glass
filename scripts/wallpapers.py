"""Draws the wallpapers made for MP Nexus (frontend/wallpapers). Run: python3 scripts/wallpapers.py frontend/wallpapers"""
import numpy as np, sys, os
from PIL import Image, ImageFilter
W,H=2560,1440
OUT=sys.argv[1]
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
u=xx/W; v=yy/H; ux=np.linspace(0,1,W,dtype=np.float32)
def rng(s): return np.random.default_rng(s)
def noise2(seed,res,w=W,h=H):
    r=rng(seed).random((res[1],res[0])).astype(np.float32)
    im=Image.fromarray((r*255).astype(np.uint8)).resize((w,h),Image.BICUBIC)
    return np.asarray(im,np.float32)/255
def fbm(seed,base=4,oct=5):
    t=0;a=1;s=0
    for i in range(oct):
        t=t+a*noise2(seed+i,(base*2**i+1,max(2,int(base*2**i*H/W)+1)));s+=a;a*=.5
    return t/s
def n1(seed,n,freq):
    r=rng(seed).random(freq+3)
    x=np.linspace(0,freq,n)
    i=np.floor(x).astype(int);f=x-i;f=f*f*(3-2*f)
    return r[i]*(1-f)+r[i+1]*f
def f1(seed,n=W,base=3,oct=6):
    t=0;a=1;s=0
    for k in range(oct):
        t=t+a*n1(seed+k,n,base*2**k);s+=a;a*=.5
    return t/s
def col(h): h=h.lstrip('#'); return np.array([int(h[i:i+2],16) for i in (0,2,4)],np.float32)
def grad(stops,t):
    t=np.clip(t,0,1); out=np.zeros(t.shape+(3,),np.float32)
    ps=[p for p,_ in stops]; cs=[col(c) for _,c in stops]
    for k in range(3): out[...,k]=np.interp(t,ps,[c[k] for c in cs])
    return out
def glow(cx,cy,r,aspect=1):
    d=((u-cx)*W/H)**2/aspect+((v-cy))**2
    return np.exp(-d/(r*r))
def mix(a,b,m): m=m[...,None] if m.ndim==2 else m; return a*(1-m)+b*m
def ridge(img,seed,yb,amp,c,base=3,soft=1.5,haze=None):
    y=(yb-amp*f1(seed,W,base))*H
    m=np.clip((yy-y[None,:])/soft+.5,0,1)
    return mix(img,np.broadcast_to(col(c),img.shape),m)
def save(name,img,grain=2.2):
    img=img+rng(9).normal(0,grain,img.shape).astype(np.float32)
    Image.fromarray(np.clip(img,0,255).astype(np.uint8)).save(f'{OUT}/{name}.webp',quality=84,method=6)
# 1 aurore
img=grad([(0,'#020a18'),(.55,'#06203a'),(1,'#041322')],v)
img+= (glow(.5,1.1,.5)*30)[...,None]*np.array([0,.4,.5])
for i,(sh,hue,s) in enumerate([(0,'#3dffb0',11),(.12,'#38d3ff',12),(-.1,'#9b7bff',13)]):
    c=.30+sh*.5+.05*np.sin(ux*2.2+i*2)+.22*(f1(s,W,2,4)-.5)
    cur=c[None,:]
    band=np.exp(-((v-cur)/.035)**2)
    tail=np.clip((cur-v)/.33,0,1)*np.exp(-((v-cur)/.32)**2)*(v<cur)
    streak=.55+.45*noise2(s+40,(160,2))
    a=(band*.9+tail*.75)*streak*(.6+.4*fbm(s+70,3,3))
    img=img+a[...,None]*col(hue)*.55
st=rng(5).random((H,W))>.9993
img[st]+=170*rng(6).random(st.sum())[:,None]
img=ridge(img,21,.86,.16,'#030b14',4,2)
img=ridge(img,22,.95,.09,'#01060c',5,2)
save('aurore',img)
# 2 crepuscule (mountains)
img=grad([(0,'#1b1745'),(.38,'#6b3b74'),(.6,'#e0806a'),(.72,'#f6b980'),(1,'#f6b980')],v)
img+= (glow(.68,.66,.13)*90)[...,None]*col('#ffd7a0')/255
cs=['#7a4a7d','#5b3466','#3d2450','#24163a','#140c25']
for i,c in enumerate(cs):
    img=ridge(img,30+i,.62+i*.085,.13-i*.012,c,3+i,1.5)
    img=mix(img,np.broadcast_to(col('#f0a07a'),img.shape),np.clip(((.7+i*.085)-v)*0,0,1))
save('crepuscule',img)
# 3 ocean
img=grad([(0,'#03111f'),(.45,'#08304d'),(1,'#021624')],v)
img+=(glow(.25,.15,.35)*45)[...,None]*col('#7fd8ff')/255
for i in range(9):
    yb=.42+i*.07; amp=.012+.004*i
    y=(yb+amp*np.sin(ux*(5+i*1.3)*np.pi+i)+.025*(f1(40+i,W,6)-.5))*H
    m=np.clip((yy-y[None,:])/2+.5,0,1)
    c=mix(col('#0b4a6d')[None,None,:],col('#021827')[None,None,:],np.full((1,1),i/9))
    hl=np.exp(-((yy-y[None,:])/6)**2)*(.25+.5*f1(60+i,W,8))[None,:]
    img=mix(img,np.broadcast_to(c,img.shape),m)+hl[...,None]*col('#5fd0ff')*.35
save('ocean',img)
# 4 foret
img=grad([(0,'#0d1f1c'),(.5,'#28463c'),(1,'#0a1613')],v)
img+=(glow(.75,.25,.3)*70)[...,None]*col('#d9f2c8')/255
cs=['#3c5b4c','#2d4a3d','#20392f','#152a22','#0b1a15']
for i,c in enumerate(cs):
    base=.45+i*.1
    tf=f1(70+i,W,40+i*10,3)
    img=ridge(img,70+i,base,.12+.06*(i%2),c,5+i,1.4)
    img=mix(img,np.broadcast_to(col('#9cc3ad'),img.shape),np.clip((1-np.abs(v-(base+.03))/.06),0,1)*.12*(1-i/5))
img=mix(img,np.broadcast_to(col('#a8c8b8'),img.shape),fbm(80,2,4)*.12)
save('foret',img)
# 5 dunes
img=grad([(0,'#2a1d3a'),(.35,'#8a4f5a'),(.5,'#e19a6b'),(1,'#e19a6b')],v)
img+=(glow(.3,.42,.08)*120)[...,None]*col('#ffe1b0')/255
for i in range(6):
    yb=.48+i*.09
    y=(yb-.08*np.sin(ux*np.pi*(1.2+i*.3)+i*1.7)-.04*f1(90+i,W,2))*H
    d=(yy-y[None,:])
    lit=np.clip(1-d/(140+i*30),0,1)
    c1=mix(col('#e8a074')[None,None],col('#5a2f35')[None,None],np.full((1,1),i/6))
    c2=mix(col('#9e5d4f')[None,None],col('#2a1620')[None,None],np.full((1,1),i/6))
    body=mix(np.broadcast_to(c2,img.shape),np.broadcast_to(c1,img.shape),lit*(1+0*u))
    img=mix(img,body,np.clip(d/2+.5,0,1))
save('dunes',img)
# 6 nuit etoilee
img=grad([(0,'#02040c'),(.6,'#0a1230'),(1,'#141c3e')],v)
band=np.exp(-(((v-.3)-(u-.5)*-.55)/.12)**2)
neb=fbm(100,4,6)
img+=(band*neb*110)[...,None]*np.array([.75,.7,1])
img+=(band*fbm(110,6,5)*60)[...,None]*col('#ff9ad5')/255*np.clip(neb-.4,0,1)[...,None]*2
r=rng(7); n=6500
sx=r.integers(0,W,n); sy=r.integers(0,H,n); b=r.random(n)**3*255
img[sy,sx]+=b[:,None]
big=r.random(160)
for x,y,bb in zip(r.integers(0,W,160),r.integers(0,int(H*.8),160),big):
    g=np.exp(-(((xx[max(0,y-6):y+7,max(0,x-6):x+7]-x)**2+(yy[max(0,y-6):y+7,max(0,x-6):x+7]-y)**2)/3))
    img[max(0,y-6):y+7,max(0,x-6):x+7]+=g[...,None]*200*bb
img=ridge(img,120,.9,.12,'#03050b',3,2)
save('nuit',img)
# 7 brume (mesh blobs)
img=np.broadcast_to(col('#0d1424'),(H,W,3)).copy()
for cx,cy,r,c in [(.15,.2,.45,'#2b3f8f'),(.8,.25,.4,'#6b3a8f'),(.6,.85,.5,'#1f6f8b'),(.1,.9,.35,'#3a2a6b'),(.45,.45,.3,'#2e5b9a')]:
    img=mix(img,np.broadcast_to(col(c),img.shape),glow(cx,cy,r)*.85)
save('brume',img,3)
# 8 lagon
img=np.broadcast_to(col('#06232b'),(H,W,3)).copy()
for cx,cy,r,c in [(.2,.3,.45,'#0f6f73'),(.85,.2,.35,'#1d8a8a'),(.7,.8,.5,'#0a4a5e'),(.35,.75,.3,'#2aa59a'),(.55,.4,.25,'#145a6e')]:
    img=mix(img,np.broadcast_to(col(c),img.shape),glow(cx,cy,r)*.8)
caust=np.abs(np.sin((fbm(130,3,4)*14)))
img+=(np.clip(1-caust*4,0,1)*np.asarray(Image.fromarray((np.clip(1-caust*4,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6)),np.float32)/255*0+np.asarray(Image.fromarray((np.clip(1-caust*4,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10)),np.float32)/255*14)[...,None]*col('#bff7ee')/255
save('lagon',img,3)
# 9 graphite
img=grad([(0,'#15171b'),(1,'#07080a')],v*.7+u*.3)
img+=(glow(.8,.1,.5)*22)[...,None]
fib=noise2(140,(1200,6)); img+=((fib-.5)*10)[...,None]
save('graphite',img,3)
# 10 ambre (warm bokeh)
img=grad([(0,'#1a0f08'),(1,'#2b170b')],v)
r=rng(11)
for k in range(70):
    cx,cy,rad=r.random(),r.random()*.9+.05,r.random()*.05+.012
    c=['#ffb35a','#ff8a3d','#ffd28a','#e8763a'][k%4]
    d=np.sqrt(((u-cx)*W/H)**2+(v-cy)**2)/rad
    disk=np.clip((1.05-d)*12,0,1)*(.12+.25*r.random())*(.6+.4*np.clip(d,0,1))
    img=img+disk[...,None]*col(c)*.9
img=Image.fromarray(np.clip(img,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
save('ambre',np.asarray(img,np.float32))
