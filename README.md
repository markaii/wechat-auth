# wechat-auth

[![npm version](https://badge.fury.io/js/wechat-auth.svg)](https://www.npmjs.com/package/wechat-auth)
[![Build Status](https://travis-ci.org/markaii/wechat-auth.svg?branch=master)](https://travis-ci.org/markaii/wechat-auth)
[![Dependencies Status](https://david-dm.org/markaii/wechat-auth.svg)](https://david-dm.org/markaii/wechat-auth)


(nodejs)微信公众号第三方平台授权sdk(注意：老版本里面component_access_token的处理不正确，请升级到最新版)

针对微信公众号第三方开发者，封装了授权流程中的主要api,
详情见微信开放平台文档[授权流程说明](https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1453779503&token=e7e06f30f4625f3274a06dd29b07d76f8aa00da7&lang=zh_CN)。

同时，封装了代公众号发起网页授权的相关接口，详情见[代公众号发起网页授权](https://open.weixin.qq.com/cgi-bin/showdocument?action=dir_list&t=resource/res_list&verify=1&id=open1419318590&token=&lang=zh_CN)

该模块主要参考了[node-webot](https://github.com/node-webot)的[wechat-oauth](https://github.com/node-webot/wechat-oauth)
和[wechat-api](https://github.com/node-webot/wechat-api)

使用该插件完成授权之后，可以利用[open-wechat-api](https://github.com/markaii/open-wechat-api)去执行微信公众号的各项主动调用api

## 功能列表

### 基础授权

- 获取第三方平台component_access_token
- 获取预授权码pre_auth_code
- 获取公众号的接口调用凭据和授权信息
- 刷新授权公众号的接口调用凭据
- 获取授权公众号账号基本信息
- 获取授权方的选项设置信息
- 设置授权方的选项信息

### 网页授权

- 获取授权页面的URL地址
- 通过code换取access_token
- 刷新access_token
- 通过access_token获取用户基本信息

## 安装

```
$ npm install wechat-auth
```

## 使用方法(基础授权)

使用该插件需要自己缓存微信第三方平台所需的`component_verify_ticket`,
`component_access_token`，建议存储在redis中，参考以下方法创建授权对象实例：

```js
var WXAuth = require('wechat-auth');

/*
 * 获取全局component_verify_ticket的方法
 * 从redis缓存中读取
 */
var getVerifyTicket = function(callback) {
  return redisClient.get('component_verify_ticket', function(err, ticket) {
    if (err) {
      return callback(err);
    } else if (!ticket) {
      return callback(new Error('no component_verify_ticket'));
    } else {
      return callback(null, ticket);
    }
  });
};

/*
 * 获取全局component_access_token的方法
 * 从redis缓存中读取
 */
var getComponentToken = function(callback) {
  return redisClient.get('component_access_token', function(err, token) {
    if (err) {
      return callback(err);
    } else {
      return callback(null, JSON.parse(token));
    }
  });
};

/*
 * 保存component_access_token到redis中
 */
var saveComponentToken = function(token, callback) {
  return redisClient.setex('component_access_token', 7000, JSON.stringify(token), function(err, reply) {
    if (err) {
      callback(err);
    }
    return callback(null);
  });
};

var wxauth = new WXAuth(appid, appsecret, getVerifyTicket, getComponentToken, saveComponentToken);
```

### 获取第三方平台component_access_token

```js
wxauth.getLatestComponentToken(function(err, token) {
  // TODO
});
```

### 获取预授权码pre_auth_code

```js
wxauth.getPreAuthCode(function(err, reply) {
  // TODO
});
```

### 获取公众号的接口调用凭据和授权信息

```js
// auth_code 授权完成后微信返回的授权码
wxauth.getAuthToken(auth_code, function(err, reply) {
  // TODO
});
```

### 刷新授权公众号的接口调用凭据

```js
// authorizer_appid 授权公众号的appid
// authorizer_refresh_token 从微信获取的公众号刷新token，存储在db中
wxauth.refreshAuthToken(authorizer_appid, authorizer_refresh_token, function(err, reply) {
  // TODO
});
```

### 获取授权公众号账号基本信息

```js
// authorizer_appid 授权公众号的appid
wxauth.getAuthInfo(authorizer_appid, function(err, reply) {
  // TODO
});
```

### 获取授权方的选项设置信息

```js
// authorizer_appid 授权公众号的appid
// option_name 选项名
wxauth.getAuthOption(authorizer_appid, option_name, function(err, reply) {
  // TODO
});
```

### 设置授权方的选项信息

```js
// authorizer_appid 授权公众号的appid
// option_name 选项名
// option_value选项值
wxauth.setAuthOption(authorizer_appid, option_name, option_value, function(err, reply) {
  // TODO
});
```

## 网页授权

### 获取授权页面的URL地址

```js
// appid 授权公众号的appid
// redirect 授权后要跳转的地址
// state 开发者可提供的数据
// scope 作用范围，值为snsapi_userinfo和snsapi_base，前者用于弹出，后者用于跳转
var oauthUrl = wxauth.getOAuthURL(appid, redirect, state, scope);
```
### 通过code换取access_token

```js
// appid 授权公众号的appid
// code 授权获取到的code
// callback 回调函数
wxauth.getOAuthAccessToken(appid, code, function(err, reply) {
  // TODO
});
```

### 刷新access_token

```js
// appid 授权公众号的appid
// refresh_token 授权刷新token
// callback 回调函数
wxauth.refreshOAuthAccessToken(appid, refresh_token, function(err, reply) {
  // TODO
});
```


### 通过access_token获取用户基本信息

```js
// openid 授权用户的唯一标识
// access_token 网页授权接口调用凭证
// lang 语言版本，zh_CN 简体，zh_TW 繁体，en 英语
// callback 回调函数
wxauth.getUserInfo(openid, access_token, lang, function(err, reply) {
  // TODO
});
```

## Licence

MIT
