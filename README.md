# IQRA Tube (hosted version)

Channel add korle video gulo nije theke YouTube theke load hoy, ar app er bhitor e cholay.

## 1. YouTube API key
1. console.cloud.google.com e jao, notun project banao.
2. "YouTube Data API v3" Enable koro.
3. Credentials > Create credentials > API key.

## 2. GitHub e upload
Ei pura folder ta ekta notun GitHub repo te upload koro.

## 3. Netlify te deploy
1. app.netlify.com > Add new site > Import from Git > repo bachho.
2. Site configuration > Environment variables e duto dao:
   - YT_API_KEY = tomar API key
   - ADMIN_PASS = tomar pochondo moto admin password
3. Deploy. Tarpor site e giye Admin > password dao > channel link add koro.

Channel link format: https://youtube.com/@name
