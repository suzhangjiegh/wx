var request = require('request');
var xml =require('xml');
var md5 =require('md5');
var dom =require('xmldom').DOMParser;
var select =require('xpath.js');
var cache =require('memory-cache');
var sha1 = require('sha1');
var wxconfig = require('./config');
var fs=require('fs');


var createNonceStr = function () {
	return Math.random().toString(36).substr(2, 15);
};

var createTimestamp = function () {
	return parseInt(new Date().getTime() / 1000) + '';
};

/**
 *  ssl 微信退单需要使用
 */
var key = fs.readFileSync('wx/ssl/apiclient_key.pem');
var cert =fs.readFileSync('wx/ssl/apiclient_cert.pem');
var ca = [ fs.readFileSync('wx/ssl/rootca.pem')];


var errData = {code:500,mes:'请求错误'};

/**
 * [token 获得全局token]
 */
module.exports.accessToken=function (callback) {

	var access_token = cache.get('access_token');

	if (access_token) {
		callback({code:200,access_token:access_token});
		return;
	}
	function getAccessToken() {
		return 'https://api.weixin.qq.com/cgi-bin/token'+
		'?grant_type=client_credential'+
		'&appid='+wxconfig.appid+
		'&secret='+wxconfig.secret;
	}

	request(getAccessToken(),function (error, response, body) {
		var accessMap = JSON.parse(body);
		//console.log('-----access_token---accessMap-----');
		//console.log(accessMap);

		if (error) {
			console.log('获取微信全局token失败');
			callback(errData);
			return;
		}
		console.log('获取微信全局token成功');			
		cache.put('access_token',accessMap.access_token,7200*1000);
		callback({code:200,access_token:accessMap.access_token});
		
	});
};

/**
 * [openid 获取openid]
 */
module.exports.openid = function (code,callback) {
	//console.log('-----code--------');
	//console.log(code);

	function getOpenId() {
		return 'https://api.weixin.qq.com/sns/oauth2/access_token'+
		'?appid='+wxconfig.appid+
		'&secret='+wxconfig.secret+
		'&code='+code+'&grant_type=authorization_code';
	}

	request(getOpenId(),function (error, response, body) {
		var ticketMap = JSON.parse(body);

		//console.log('-----openid-ticketMap-------');
		console.log(ticketMap);

		if (error) {
			callback(errData);
			return;
		}
		callback({code:200,openid:ticketMap.openid});		
		
	});	
};

/**
 * [userInfo 用户详情]
 */
module.exports.userInfo = function (openid,callback) {

	this.accessToken(function (data) {	
		if (data.code!=200) {
			callback(errData);
			return;
		}
		function getUserInfoUrl() {
			return 'https://api.weixin.qq.com/cgi-bin/user/info'+
			'?access_token=' + data.access_token+ 
			'&openid=' + openid;
		}
		request(getUserInfoUrl(),function (error, response, body) {
			var userMap = JSON.parse(body);

			//console.log('-----userInfo--------');
			console.log(userMap);

			if (error) {
				callback(errData);
				return;
			}
			callback({code:200,userMap:userMap,mes:''});	
			
		});
		
	});
};

/**
 * [jsApiTicket 使用jssdk必要的凭证]
 */
module.exports.jsApiTicket =function (callback) {
	var jsapi_ticket =  cache.get('jsapi_ticket');

	if (jsapi_ticket) {
		callback({code:200,jsapi_ticket:jsapi_ticket});
		return;
	}	
		
	this.accessToken(function (data) {
		if (data.code!=200) {
			callback(errData);
			return;
		}
		function getjsApiTicketUrl() {
			return 'https://api.weixin.qq.com/cgi-bin/ticket/getticket'+
			'?access_token=' + data.access_token + '&type=jsapi';
		}

		request(getjsApiTicketUrl(),function (error, response, body) {

			var jsaApiTicketMap = JSON.parse(body);
			//console.log('-----jsaApiTicketMap--------');
			console.log(jsaApiTicketMap);
			
			if (error) {
				callback(errData);
				return;
			}
			
			jsapi_ticket =jsaApiTicketMap.ticket;
			if (jsaApiTicketMap.errcode == 0) {
				cache.put('jsapi_ticket',jsapi_ticket,7200*1000);
				callback({code:200,jsapi_ticket:jsapi_ticket,mes:''});
				return;
			}
				
			callback({code:404,mes:'参数错误'});
			
		});
		
	});
		
};

/**
 * [jssdk 的配置信息]
 */
module.exports.jsSDKMap=function (url,callback) {

	var jsSDKMap = {
		appId:wxconfig.appid,
		nonceStr:createNonceStr(),
		timeStamp:createTimestamp(), 
		signature:''
	};

	this.jsApiTicket(function(data){
		if (data.code!=200) {
			callback(errData);
			return;
		}
		jsSDKMap.signature=sha1(
			'jsapi_ticket=' + data.jsapi_ticket + 
			'&noncestr=' + jsSDKMap.nonceStr + 
			'&timestamp=' + jsSDKMap.timeStamp + 
			'&url=' + url);

		//console.log(jsSDKMap);	
		callback({code:200,jsSDKMap:jsSDKMap});
		
	});
};


/**
 * [wxCordToken 获得卡卷需要的凭证]
 */
module.exports.wxCordToken = function (callback) {
	var api_ticket = cache.get('api_ticket');

	if (api_ticket) {
		callback({code:200,api_ticket:api_ticket});
		return;
	}

	this.accessToken(function (data) {
	
		if (data.code!=200) {
			callback(errData);
			return;
		}
		function getCodeApiTicketUrl() {
			return 'https://api.weixin.qq.com/cgi-bin/ticket/getticket'
			+'?access_token='+data.access_token
			+'&type=wx_card';
		}

		request(getCodeApiTicketUrl(),function (error, response, body) {

			var accessMap = JSON.parse(body);	
			if (error) {
				console.log('获取微信全局token失败');
				callback(errData);
				return;
			}
			cache.put('api_ticket',accessMap.ticket,7200*1000);
			callback({code:200,api_ticket:accessMap.ticket});		
		});	
	});
};

/**
 * [wxCordMap 传递到前端需要的签名,和其他配置信息]
 */
module.exports.wxCordMap = function (callback) {
	this.wxCordToken(function (data) {
		//console.log(data);
		var timestamp = createTimestamp();
		var nonceStr = createNonceStr();
		var api_ticket =data.api_ticket;
		var appid =wxconfig.appid;
		
		var arr = [timestamp
		,api_ticket
		,nonceStr
		,appid
		];
	
		var str = arr.sort().join('');
		var cardSign =sha1(str);

		//console.log('-------cardSign-------');
		console.log(cardSign);

		var wxCordMap = {
			timestamp:timestamp,
			nonceStr:nonceStr,
			cardSign:cardSign
		};
		callback({code:200,wxCordMap:wxCordMap});
	});
};

/**
 * [deCode 前端Code解码]
 */
module.exports.deCode = function (encrypt_code,callback) {
	this.accessToken(function (data) {
		if (data.code!=200) {
			callback(errData);
			return;
		}
		var access_token = data.access_token;

		var decodeUrl= 'https://api.weixin.qq.com/card/code/decrypt?access_token='
		+access_token;

		request.post({
			url:decodeUrl,
			body:JSON.stringify({encrypt_code: encrypt_code})
		},function (error, response, body) {
			if (error) {
				callback(errData);
				return;
			}
			body = JSON.parse(body);
			console.log('----deCode-------');
			console.log(body.code);
			callback({code:200,cardCode:body.code,access_token:access_token});
		});
	});
};

/**
 * [queryCode 卡卷查询]
 */
module.exports.queryCode = function (encrypt_code,callback) {
	console.log('------1-----');
	this.deCode(encrypt_code,function (data) {
		if (data.code!=200) {
			console.log('------err-----');
			callback(errData);
			return;
		}
		var queryCodeUrl = 'https://api.weixin.qq.com/card/code/get?access_token='
			+data.access_token;
		request.post({
			url:queryCodeUrl,
			body:JSON.stringify({code: data.code})
		},function (error, response, body) {
			console.log(body);
			var json =JSON.parse(body);

			console.log('---------json--------');
			console.log(json);
			callback({code:200,data:body});
		});
	});
};

/*module.exports.wxtest =function () {
	var timestamp =1491988005;
	var api_ticket='IpK_1T69hDhZkLQTlwsAX7Lm9dKD5fopni-t6XiJNmUIoqILstyqUO8G_yV6xwHdOYuZgR54ssA6fhsEYY-P5w';
	var nonceStr ='eeon3na4ppcts26';

	var appid ='wx572bce4b281d30b2';
	var card_type = '1';


	console.log('-------appid-------');
	console.log(appid);
	
	console.log('------api_ticket--------');
	console.log(api_ticket);

	console.log('------timestamp--------');
	console.log(timestamp);

	console.log('-----nonceStr---------');
	console.log(nonceStr);

	console.log('-------str-------');
	console.log(str);

	console.log('-------cardSign-------');
	console.log(cardSign);
	
};
this.wxtest();*/

/**
 * [beforePay 生成订单]
 */

var pay_notify_url = 'http://pay.emomo.cc/wx/payok';

module.exports.beforePay = function (ip,openid,price,number,callback) {
	var noncestr=createNonceStr();
	//商品描述
	var body = 'This is a test';
	var stringA='appid='+wxconfig.appid+
	'&body='+body+
	'&mch_id='+wxconfig.pay.mch_id+
	'&nonce_str='+noncestr+
	'&notify_url='+pay_notify_url+
	'&openid='+openid+
	'&out_trade_no='+number+
	'&spbill_create_ip='+ip+
	'&total_fee='+price+
	'&trade_type='+wxconfig.pay.trade_type;

	var stringSignTemp =stringA+'&key='+wxconfig.pay.key;
	var sign = md5(stringSignTemp).toUpperCase();

	var xmlStr =[{xml:[
			{appid:wxconfig.appid},
			{body:body},
			{mch_id:wxconfig.pay.mch_id},
			{nonce_str:noncestr},
			{notify_url:pay_notify_url},
			{openid:openid},
			{out_trade_no:number},
			{spbill_create_ip:ip},
			{total_fee:price},
			{trade_type:wxconfig.pay.trade_type},
			{sign:sign}
	]
	}];
	var allXmlStr= xml(xmlStr);
	//console.log(allXmlStr);
	
	function orderUrl() {
		return 'https://api.mch.weixin.qq.com/pay/unifiedorder';
	}

	request.post({
		url:orderUrl(),
		form:allXmlStr
	},function (error, response, body) {
	
		console.log('微信预下单\r\n',body);

		var doc =new dom().parseFromString(body);
		var nodes =select(doc,'//prepay_id');
		var timeStamp =createTimestamp();

		var prepay_id;
		try{
			prepay_id=nodes[0].firstChild.data;
		}catch(err){
			//console.log('------err-----');
			//console.log(err);
			callback(errData);
			return;
		}

		var package ='prepay_id='+prepay_id;
		var signType='MD5';

		var stringB ='appid='+wxconfig.appid+
		'&nonceStr='+noncestr+
		'&package='+package+
		'&signType='+signType+
		'&timeStamp='+timeStamp;

		var stringSignTempPay =stringB+'&key='+wxconfig.pay.key;
		var paySign =md5(stringSignTempPay);
		// sn =md5(number+price+'iwean');

		console.log('stringB ='+stringB);

		var beforePayMap = {
			timeStamp:timeStamp,
			nonceStr:noncestr,
			package:package,
			signType:signType,
			paySign:paySign
		};
		if (error) {
			callback(errData);
			return;
		}
			
		callback({code:200,beforePayMap:beforePayMap});
		
	});
};

/*module.exports.afterPay = function (req,res) {
	var body = req.body;
	var xmlStr =[{xml:[
			{return_code: '![CDATA[SUCCESS]]'},
	]}];
	var allXmlStr= xml(xmlStr);
	console.log(allXmlStr);
};*/

//this.afterPay();
/*module.exports.refund = function () {

	var refundNo = '123456';
	var tradeNo  = '1234567';
	var totalFee = '1';
	var refundFee = '1'; 

	var noncestr=createNonceStr();
	//var transaction_id = '';
	var stringA='appid='+wxconfig.appid+
	'&mch_id='+wxconfig.pay.mch_id+
	'&nonce_str='+noncestr+
	'&op_user_id='+wxconfig.pay.mch_id+
	'&out_refund_no='+refundNo+
	'&out_trade_no='+tradeNo+
	'&refund_fee='+refundFee+
	'&total_fee='+totalFee;
	//'&transaction_id='+transaction_id;

	var stringSignTemp =stringA+'&key='+wxconfig.pay.key;
	var sign = md5(stringSignTemp).toUpperCase();

	var xmlStr =[{xml:[
			{appid:wxconfig.appid},
			{mch_id:wxconfig.pay.mch_id},
			{nonce_str:noncestr},
			{op_user_id:wxconfig.pay.mch_id},
			{out_refund_no:refundNo},
			{out_trade_no:tradeNo},
			{refund_fee:refundFee},
			{total_fee:totalFee},
			//{transaction_id:transaction_id},
			{sign:sign}
	]
	}];

	var allXmlStr= xml(xmlStr);
	console.log(allXmlStr);
	
	var refundUrl ='https://api.mch.weixin.qq.com/secapi/pay/refund';

	request.post({
		url:refundUrl,
		form:allXmlStr,
		key:key,
		cert:cert,
		ca:ca,
		rejectUnauthorized:true
	},function (error, response, body){
		console.log(body);
	});
};*/


