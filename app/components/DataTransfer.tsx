'use client';

import { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BrowserMultiFormatReader, Result } from '@zxing/library';

interface DataTransferProps {
  stockList: any[];
  onImport: (data: any[]) => void;
}

const DataTransfer: React.FC<DataTransferProps> = ({ stockList, onImport }) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [qrData, setQrData] = useState<string>('');
  const [chunks, setChunks] = useState<{ total: number; current: number }>({ total: 1, current: 1 });
  const [scanResult, setScanResult] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>('');
  const [importedChunks, setImportedChunks] = useState<{ [key: number]: string }>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  // データをチャンクに分割（QRコードの容量制限のため）
  const prepareDataForExport = () => {
    const data = JSON.stringify(stockList);
    // QRコードの容量制限を考慮して、データを1000文字ずつに分割
    const chunkSize = 1000;
    const chunksCount = Math.ceil(data.length / chunkSize);
    const chunks = [];

    for (let i = 0; i < chunksCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, data.length);
      const chunk = data.substring(start, end);
      // チャンク情報を追加（現在のチャンク番号と総チャンク数）
      const chunkData = {
        data: chunk,
        chunk: i + 1,
        total: chunksCount,
      };
      chunks.push(JSON.stringify(chunkData));
    }

    setChunks({ total: chunksCount, current: 1 });
    setQrData(chunks[0]);
  };

  // チャンクを切り替える
  const changeChunk = (direction: 'next' | 'prev') => {
    let newCurrent = direction === 'next' ? chunks.current + 1 : chunks.current - 1;
    
    if (newCurrent < 1) newCurrent = chunks.total;
    if (newCurrent > chunks.total) newCurrent = 1;
    
    setChunks({ ...chunks, current: newCurrent });
    
    const data = JSON.stringify(stockList);
    const chunkSize = 1000;
    const start = (newCurrent - 1) * chunkSize;
    const end = Math.min(start + chunkSize, data.length);
    const chunk = data.substring(start, end);
    
    const chunkData = {
      data: chunk,
      chunk: newCurrent,
      total: chunks.total,
    };
    
    setQrData(JSON.stringify(chunkData));
  };

  // QRコードスキャンを開始
  const startScan = async () => {
    setIsScanning(true);
    setScanError('');
    
    try {
      readerRef.current = new BrowserMultiFormatReader();
      const videoInputDevices = await readerRef.current.listVideoInputDevices();
      
      if (videoInputDevices.length === 0) {
        setScanError('カメラが見つかりません');
        setIsScanning(false);
        return;
      }
      
      const firstDeviceId = videoInputDevices[0].deviceId;
      
      if (videoRef.current) {
        readerRef.current.decodeFromVideoDevice(
          firstDeviceId,
          videoRef.current,
          (result: Result | undefined, error: Error | undefined) => {
            if (result) {
              handleScanResult(result.getText());
            }
            if (error && !(error instanceof TypeError)) {
              console.error('Scan error:', error);
            }
          }
        );
      }
    } catch (error) {
      console.error('Error starting scan:', error);
      setScanError('カメラの起動に失敗しました');
      setIsScanning(false);
    }
  };

  // QRコードスキャンを停止
  const stopScan = () => {
    if (readerRef.current) {
      readerRef.current.reset();
      readerRef.current = null;
    }
    setIsScanning(false);
  };

  // スキャン結果を処理
  const handleScanResult = (result: string) => {
    try {
      const parsedResult = JSON.parse(result);
      
      if (parsedResult.chunk && parsedResult.total) {
        // チャンクデータを保存
        setImportedChunks(prev => ({
          ...prev,
          [parsedResult.chunk]: parsedResult.data
        }));
        
        setScanResult(`チャンク ${parsedResult.chunk}/${parsedResult.total} を読み込みました`);
        
        // すべてのチャンクが揃ったかチェック
        if (Object.keys(importedChunks).length + 1 >= parsedResult.total) {
          const allChunks = { ...importedChunks, [parsedResult.chunk]: parsedResult.data };
          
          // チャンクを順番に並べて結合
          let completeData = '';
          for (let i = 1; i <= parsedResult.total; i++) {
            if (allChunks[i]) {
              completeData += allChunks[i];
            } else {
              setScanResult(`チャンク ${i} が見つかりません。再スキャンしてください。`);
              return;
            }
          }
          
          // 完全なデータをインポート
          try {
            const importedData = JSON.parse(completeData);
            onImport(importedData);
            setScanResult('データのインポートに成功しました！');
            stopScan();
            setImportedChunks({});
          } catch (e) {
            setScanError('データの解析に失敗しました');
          }
        }
      }
    } catch (e) {
      setScanError('QRコードの読み取りに失敗しました');
    }
  };

  // タブが変更されたときの処理
  const handleTabChange = (tab: 'export' | 'import') => {
    setActiveTab(tab);
    if (tab === 'export') {
      stopScan();
      prepareDataForExport();
    } else {
      setImportedChunks({});
      setScanResult('');
      setScanError('');
    }
  };

  // コンポーネントがマウントされたときにエクスポートデータを準備
  useEffect(() => {
    if (activeTab === 'export') {
      prepareDataForExport();
    }
  }, [activeTab, stockList]);

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
      <div className="flex mb-4 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`py-2 px-4 ${
            activeTab === 'export'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          onClick={() => handleTabChange('export')}
        >
          データのエクスポート
        </button>
        <button
          className={`py-2 px-4 ${
            activeTab === 'import'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'text-gray-500 dark:text-gray-400'
          }`}
          onClick={() => handleTabChange('import')}
        >
          データのインポート
        </button>
      </div>

      {activeTab === 'export' && (
        <div className="flex flex-col items-center">
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            以下のQRコードをスキャンして、データを別のデバイスにインポートできます。
          </p>
          
          {chunks.total > 1 && (
            <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
              データサイズが大きいため、{chunks.total}個のQRコードに分割されています。
              すべてのQRコードをスキャンしてください。
            </p>
          )}
          
          <div className="bg-white p-4 rounded-lg mb-4">
            <QRCodeSVG value={qrData} size={250} />
          </div>
          
          {chunks.total > 1 && (
            <div className="flex items-center mb-4">
              <button
                onClick={() => changeChunk('prev')}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-l-md"
              >
                ←
              </button>
              <span className="px-4 py-1 bg-gray-100 dark:bg-gray-800">
                {chunks.current} / {chunks.total}
              </span>
              <button
                onClick={() => changeChunk('next')}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-r-md"
              >
                →
              </button>
            </div>
          )}
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            注意: QRコードを読み取る際は、すべてのコードを順番にスキャンしてください。
          </p>
        </div>
      )}

      {activeTab === 'import' && (
        <div className="flex flex-col items-center">
          <p className="mb-4 text-gray-700 dark:text-gray-300">
            カメラでQRコードをスキャンして、データをインポートします。
          </p>
          
          {!isScanning ? (
            <button
              onClick={startScan}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              スキャン開始
            </button>
          ) : (
            <div className="w-full max-w-md">
              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <video ref={videoRef} className="w-full h-auto" />
              </div>
              
              {scanResult && (
                <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-md">
                  {scanResult}
                </div>
              )}
              
              {scanError && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-md">
                  {scanError}
                </div>
              )}
              
              <button
                onClick={stopScan}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                スキャン停止
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTransfer; 