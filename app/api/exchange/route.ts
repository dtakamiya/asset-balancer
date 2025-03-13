import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

// ユーザーエージェントを設定
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

export async function GET() {
  try {
    // Yahoo!ファイナンスから為替レートを取得
    const rate = await fetchExchangeRate();
    
    return NextResponse.json({
      success: true,
      rate: rate
    });
  } catch (error) {
    console.error('為替レート取得エラー:', error);
    return NextResponse.json({ 
      success: false,
      error: '為替レートの取得に失敗しました',
      rate: 150 // デフォルト値として150円/ドルを使用
    }, { status: 500 });
  }
}

async function fetchExchangeRate() {
  try {
    // Yahoo!ファイナンスから為替レート（USD/JPY）を取得
    const url = 'https://finance.yahoo.co.jp/quote/USDJPY=X';
    
    // APIを使用
    try {
      const apiUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/USDJPY=X';
      const apiResponse = await axios.get(apiUrl, {
        headers: { 'User-Agent': USER_AGENT }
      });
      
      if (apiResponse.data && apiResponse.data.chart && 
          apiResponse.data.chart.result && 
          apiResponse.data.chart.result[0] && 
          apiResponse.data.chart.result[0].meta) {
        
        const meta = apiResponse.data.chart.result[0].meta;
        const regularMarketPrice = meta.regularMarketPrice;
        
        if (regularMarketPrice) {
          return regularMarketPrice;
        }
      }
    } catch (apiError) {
      console.error('為替API取得エラー:', apiError);
      // APIが失敗した場合はスクレイピングにフォールバック
    }
    
    // スクレイピングでの取得を試みる
    const headers = { 'User-Agent': USER_AGENT };
    const response = await axios.get(url, { headers });
    
    const $ = cheerio.load(response.data);
    
    // 為替レートを取得
    const rateText = $('span._3rXWJKZF').first().text() || $('span[data-test="qsp-price"]').first().text();
    
    if (rateText) {
      // 数値だけを抽出
      const rateMatch = rateText.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
      if (rateMatch) {
        return parseFloat(rateMatch[0]);
      }
    }
    
    // 取得できなかった場合はデフォルト値を返す
    return 150;
  } catch (error) {
    console.error('為替レート取得エラー:', error);
    // エラーが発生した場合はデフォルト値を返す
    return 150;
  }
} 