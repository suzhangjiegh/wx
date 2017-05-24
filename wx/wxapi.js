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



/**
 * [jsSDKMap jssdk html 页面所需]
 * @param  {[type]}   url      [html 所在的网址]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
/*module.exports.jsSDKMap=function (url,callback) {
	var baseMsg = {
		appId:wxOpt.wechat.appID,

		appSecret:wxOpt.wechat.appSecret
	};

	var jsSDKMap = {
		appId:wxOpt.wechat.appID,
		nonceStr:createNonceStr(),
		timeStamp:createTimestamp(), 
		signature:''
	};

	this.getApiJsTicket(baseMsg,function(data){
		if (data.code!='SUCCESS') {
			callback({code:500,mes:'请求错误'});
			return;
		}


		jsSDKMap.signature=sha1(
			'jsapi_ticket=' + data.data + 
			'&noncestr=' + jsSDKMap.nonceStr + 
			'&timestamp=' + jsSDKMap.timeStamp + 
			'&url=' + url);

		callback({code:200,jsSDKMap:jsSDKMap});
		
	});
};*/

/**
 * [beforePay 预下订单]
 * @param  {[type]}   req      [description]
 * @param  {[type]}   openid   [wxopenid]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 *
 * body.costInput  body.timeInput body.funcName 
 */
/*module.exports.beforePay = function (req,openid,callback) {

	// 订单详情
	var body = req.body;

	if (body.deviceInput ==undefined) {
		callback({code:500,mes:'设备错误', subcode: 105});
		return;
	}

	if (body.costInput ==undefined) {
		callback({code:500,mes:'金额错误', subcode: 105});
		return;
	}

	if (body.timeInput ==undefined) {
		callback({code:500,mes:'时间错误', subcode: 105});
		return;
	}

	console.log(body);
	// 前端IP
	var ip = bUtils.getClientIp(req);
	if(ip.split(',').length>0){
		ip = ip.split(',')[0];
	}


	var payType = 1;
	var data = {
		deviceSn: body.deviceInput,
		cmdType: body.funcInput,
		payAmount: body.costInput,
		times: body.timeInput,
		openId: openid,
		payType: payType,
		funcName: body.funcName
	};
	console.log('======================');
	console.log(data);

	var dat = JSON.stringify(data);

	var opt = {
		body: dat,
		path: rest['proxy'].createOrder
	};

	console.log('请求参数：', opt);

	bHttp.doPost(opt, function(status, data) {
		console.log('-----------支付------------');
		console.log(data);

		if (data ==undefined && status!=200) {
			callback({code:500, subcode: 105,mes:'服务器错误'});
			return;
		}

		if (data.code == 'FAIL') {
			

		}else if (data.code == 'SUCCESS') {
			if (data.data == null || data.data == undefined) {
				callback({code:500,mes:'服务器错误',subcode: 105});
				return;
			}

			// 价格
			var price = data.data.payAmount * 100;
			// 设备ID
			var deviceId = parseFloat(body.deviceInput);
			// 订单号
			var number = data.data.orderSn;

			//支付成功的回调url 
			var pay_notify_url = req.protocol + '://' + req.host + req.originalUrl + '/callback';
			var noncestr=createNonceStr();

			//附加数据 微信会返回
			var attach =  body.timeInput + '-' +  body.funcName ;
			var goods_tag ='按摩支付';
			//商品描述
			//var bodyAbout = body.timeInput+'分钟'+body.funcName;
			var bodyAbout =data.data.times + '';

			var stringA='appid='+wxOpt.wechat.appID+
			'&attach='+attach+
			'&body='+bodyAbout+
			'&goods_tag='+goods_tag+
			'&mch_id='+wxOpt.pay.mch_id+
			'&nonce_str='+noncestr+
			'&notify_url='+pay_notify_url+
			'&openid='+openid+
			'&out_trade_no='+number+
			'&spbill_create_ip='+ip+
			'&total_fee='+price+
			'&trade_type='+wxOpt.pay.trade_type;

			var stringSignTemp =stringA+'&key='+wxOpt.pay.key;
			var sign = md5(stringSignTemp).toUpperCase();

			var xmlStr =[{xml:[
					{appid:wxOpt.wechat.appID},
					{attach:attach},
					{body:bodyAbout},
					{goods_tag:goods_tag},
					{mch_id:wxOpt.pay.mch_id},
					{nonce_str:noncestr},
					{notify_url:pay_notify_url},
					{openid:openid},
					{out_trade_no:number},
					{spbill_create_ip:ip},
					{total_fee:price},
					{trade_type:wxOpt.pay.trade_type},
					{sign:sign}
			]
			}];

			var allXmlStr= xml(xmlStr);
			console.log('-----------订单签名xml-------');
			console.log(allXmlStr);
			
			var orderUrl = 'https://api.mch.weixin.qq.com/pay/unifiedorder';

			request.post({
				url:orderUrl,
				form:allXmlStr},function (error, response, body1) {

				if (error) {
					console.log(error);
					callback({code:500,mes:'请求错误', subcode: 105});
					return;
				}

				console.log('------微信预下单结果xml--------');
				console.log(body1);
				var doc =new dom().parseFromString(body1);
				
				var timeStamp =createTimestamp();
				var prepay_id;
				var return_code;
				try{
			
					return_code = select(doc,'//return_code');
					return_code= return_code[0].firstChild.data;
					console.log('------微信预下单code---------');
					console.log(return_code);

					if (return_code !='SUCCESS') {
						callback({code:500,mes:'下单错误', subcode: 105});
						return;
					}
					prepay_id =select(doc,'//prepay_id');
					prepay_id=prepay_id[0].firstChild.data;
				}catch(err){
					//console.log('------err-----');
					//console.log(err);
					callback({code:500,mes:'请求错误', subcode: 105});
					return;
				}

				var package ='prepay_id='+prepay_id;
				var signType='MD5';
				var stringB ='appId='+wxOpt.wechat.appID+
				'&nonceStr='+noncestr+
				'&package='+package+
				'&signType='+signType+
				'&timeStamp='+timeStamp;
				var stringSignTempPay =stringB+'&key='+wxOpt.pay.key;
				var paySign =md5(stringSignTempPay).toUpperCase();
				// sn =md5(number+price+'iwean');
				console.log('stringB ='+stringB);

				var beforePayMap = {
					timeStamp:timeStamp,
					nonceStr:noncestr,
					package:package,
					signType:signType,
					paySign:paySign
				};
				
				//为了支付成功校验
				

				callback({code:200,beforePayMap:beforePayMap,subcode: 100});
				
			});
		} 
		
	});
	
};*/

/**
 * [payCallback 支付成功回调]
 * @param  {[type]} req [description]
 * @param  {[type]} res [description]
 * @return {[type]}     [description]
 */
/*module.exports.payCallback = function(req, res){


	console.log('===========微信支付成功返回================');
	console.log(req.body);

    that = this;
	xml2js.parseString(req.body,{explicitArray:false,ignoreAttrs:true },function (err,result){
		
		var body = result.xml ;
		var redisNumber = body.out_trade_no ;

		bUtils.getRedisData('out_trade_no'+redisNumber,function (data) {

			if (data.status) {
				return;
			}

			var wxsign = '';
			var str = '';
			for (var obj in body) {
				if (obj == 'sign') {
					wxsign = body[obj];
					continue;
				}
				str =str + obj +'=' + body[obj] + '&' 
			}
			str = str + 'key='+wxOpt.pay.key;
			var sign = md5(str).toUpperCase();
		

			if (sign != wxsign) {
				console.log('微信支付callback sign error');
				return ;
			}

			if (body.return_code != 'SUCCESS') {
				console.log('微信支付callback return_code fail');
				return ;
			}
			console.log('微信支付callback SUCCESS');
		

			bUtils.setRedisData('out_trade_no'+redisNumber,redisNumber, 600);
			
			that.sendPayMessage(req.body);
				
		});
	});

	//  返回给微信 不可多次调用需处理
	var allXmlStr= '<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>';
	res.status(200).send(allXmlStr);	
};*/

/**
 * [sendPayMessage 发送成功信息给java]
 * @param  {[type]} url [description]
 * @param  {[type]} xml [description]
 * @return {[type]}     [description]
 */
/*module.exports.sendPayMessage = function (xml) {
	var postData = { xml: xml };
	var dat = JSON.stringify(postData);
	
	var opt = {
		body: dat,
		path: rest['proxy'].wxPayNotity

	};
	console.log(opt);
	bHttp.doPost(opt, function(status, data) {
		console.log('-------sendPayMessage-----cb----');
		console.log(data);
	});
};*/

/**
 * [orderErrPush description]
 * @param  {[type]} openid [用户信息]
 * @param  {[type]} tradeNo[订单号]
 * @param  {[type]} time   [下单时间]
 * @return {[type]}        [description]
 */
/*module.exports.orderErrPush = function (openid,tradeNo,time,callback) {

	var baseMsg ={
		appId:wxOpt.wechat.appID,
		appSecret:wxOpt.wechat.appSecret
	};

	this.getWxGlobalAccessToken(baseMsg,function (data) {
		
		var message ={
			access_token:data.data,
			touser:openid,
			template_id: wxOpt.push.order_template_id,
			url:'http://test.emomo.cc/wechat/refund'+'?tradeNo='+tradeNo,
			first:'您的订单异常',
			keyword1:tradeNo,
			keyword2:time,
			keyword3:'',
			keyword4:'设备启动失败',
			remark:'点击申请退单'
		};
	
		var pushUrl = 'https://api.weixin.qq.com/cgi-bin/message/template/send'
		+'?access_token='+ message.access_token;
		
		var json = {
			'touser':message.touser,
			'template_id':message.template_id,
			'url':message.url,            
			'data':{
				'first': {
					'value':message.first,
					'color':'#173177'
				},
				'keyword1':{
					'value':message.keyword1,
					'color':'#173177'
				},
				'keyword2': {
					'value':message.keyword2,
					'color':'#173177'
				},
				'keyword3': {
					'value':message.keyword3,
					'color':'#173177'
				},
				'keyword4': {
					'value':message.keyword4,
					'color':'#173177'
				},
				'remark':{
					'value':message.remark,
					'color':'#173177'
				}
			}
		};
	
		request.post({
			url:pushUrl,
			json: true,
			headers: {'content-type': 'application/json'},
			body:json },function (error, response, body){
			
			if (error) {
				console.log('========================');
				console.log('推送错误订单  '+tradeNo+'  失败');
				console.log('========================');
			}else{
				console.log('推送错误订单  '+tradeNo+'  成功');	
			}
		
		});
	});
};*/
/*var key = fs.readFileSync(path.join(__dirname, 'wxpay/apiclient_key.pem'),'utf-8');
var cert =fs.readFileSync(path.join(__dirname, 'wxpay/apiclient_cert.pem'),'utf-8');
var ca = [fs.readFileSync(path.join(__dirname, 'wxpay/rootca.pem'), 'utf-8')];*/

/**
 * [refund 退款]
 * @param  {[type]}   tradeNo   [商户订单号]
 * @param  {[type]}   totalFee  [订单金额]
 * @param  {[type]}   refundFee [退款金额]
 * @param  {Function} callback  [description]
 * @return {[type]}             [description]
 */
/*module.exports.refund = function (tradeNo,totalFee,refundFee,callback) {

	var refundNo = 'T'+ tradeNo;
	
	console.log('-------退款信息------');
	console.log(refundNo);
	console.log(tradeNo);
	console.log(totalFee);
	console.log(refundFee);

	var noncestr=createNonceStr();
	//var transaction_id = '';
	var stringA='appid='+wxOpt.wechat.appID+
	'&mch_id='+wxOpt.pay.mch_id+
	'&nonce_str='+noncestr+
	'&op_user_id='+wxOpt.pay.mch_id+
	'&out_refund_no='+refundNo+
	'&out_trade_no='+tradeNo+
	'&refund_fee='+refundFee+
	'&total_fee='+totalFee;
	//'&transaction_id='+transaction_id;

	var stringSignTemp =stringA+'&key='+wxOpt.pay.key;
	var sign = md5(stringSignTemp).toUpperCase();

	var xmlStr =[{xml:[
			{appid:wxOpt.wechat.appID},
			{mch_id:wxOpt.pay.mch_id},
			{nonce_str:noncestr},
			{op_user_id:wxOpt.pay.mch_id},
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

		if (error) {
			callback({code:500,mes:'退款失败'});
			return;
		}
		//成功 微信会推送模版
		console.log('-------微信返回信息------');
		console.log(body);
		callback({code:200,mes:'退款成功'});
	});
};*/
