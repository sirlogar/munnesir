package com.cevatkolat.siirarsivi;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.graphics.Color;
import android.provider.DocumentsContract;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 771;
    private static final int CREATE_JSON_REQUEST = 772;
    private static final int OPEN_JSON_FOLDER_REQUEST = 773;
    private static final int OPEN_JSON_FILE_REQUEST = 774;
    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private String pendingBackupJson;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);
        getWindow().setStatusBarColor(Color.rgb(17, 14, 21));
        getWindow().setNavigationBarColor(Color.rgb(17, 14, 21));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent intent = params.createIntent();
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (ActivityNotFoundException e) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Dosya seçici açılamadı.", Toast.LENGTH_SHORT).show();
                    return false;
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    public class AndroidBridge {
        @JavascriptInterface
        public void shareText(String title, String text) {
            runOnUiThread(() -> {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("text/plain");
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, title == null ? "Munnesir" : title);
                sendIntent.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                startActivity(Intent.createChooser(sendIntent, "Munnesir ile paylaş"));
            });
        }

        @JavascriptInterface
        public void saveBackup(String filename, String json) {
            saveJsonBackup(filename, json);
        }

        @JavascriptInterface
        public void saveJsonBackup(String filename, String json) {
            runOnUiThread(() -> {
                pendingBackupJson = json == null ? "{}" : json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, filename == null ? "munnesir-yedek.json" : filename);
                try {
                    startActivityForResult(intent, CREATE_JSON_REQUEST);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "JSON yedek kaydetme penceresi açılamadı.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void openBackupImportOptions() {
            runOnUiThread(() -> new AlertDialog.Builder(MainActivity.this)
                    .setTitle("Arşiv yedeği yükle")
                    .setItems(new String[]{"Tek JSON seç", "Klasör seç"}, (dialog, which) -> {
                        if (which == 0) openJsonFileImport();
                        else openJsonFolderImport();
                    })
                    .show());
        }

        @JavascriptInterface
        public void openJsonFileImport() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivityForResult(intent, OPEN_JSON_FILE_REQUEST);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "JSON dosya seçici açılamadı.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void openJsonFolderImport() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                try {
                    startActivityForResult(intent, OPEN_JSON_FOLDER_REQUEST);
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "Klasör seçici açılamadı.", Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK && data != null) {
                ClipData clipData = data.getClipData();
                if (clipData != null && clipData.getItemCount() > 0) {
                    ArrayList<Uri> uris = new ArrayList<>();
                    for (int i = 0; i < clipData.getItemCount(); i++) {
                        Uri uri = clipData.getItemAt(i).getUri();
                        if (uri != null) uris.add(uri);
                    }
                    results = uris.toArray(new Uri[0]);
                } else if (data.getData() != null) {
                    results = new Uri[]{data.getData()};
                } else {
                    results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
            return;
        }

        if (requestCode == CREATE_JSON_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingBackupJson != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out != null) {
                        out.write(pendingBackupJson.getBytes(StandardCharsets.UTF_8));
                        Toast.makeText(this, "JSON yedek kaydedildi.", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "JSON yedek kaydedilemedi.", Toast.LENGTH_SHORT).show();
                }
            }
            pendingBackupJson = null;
            return;
        }

        if (requestCode == OPEN_JSON_FILE_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri fileUri = data.getData();
                new Thread(() -> {
                    try {
                        JSONArray arr = new JSONArray();
                        JSONObject item = new JSONObject();
                        item.put("name", "munnesir-yedek.json");
                        item.put("content", readText(fileUri));
                        arr.put(item);
                        String quoted = JSONObject.quote(arr.toString());
                        runOnUiThread(() -> webView.evaluateJavascript("window.receiveAndroidFolderJsons(" + quoted + ")", null));
                    } catch (Exception e) {
                        runOnUiThread(() -> Toast.makeText(this, "JSON yedeği okunamadı.", Toast.LENGTH_SHORT).show());
                    }
                }).start();
            }
            return;
        }

        if (requestCode == OPEN_JSON_FOLDER_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                Uri treeUri = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception ignored) {}
                new Thread(() -> {
                    try {
                        JSONArray arr = new JSONArray();
                        collectJsonFiles(treeUri, arr, 0);
                        String quoted = JSONObject.quote(arr.toString());
                        runOnUiThread(() -> webView.evaluateJavascript("window.receiveAndroidFolderJsons(" + quoted + ")", null));
                    } catch (Exception e) {
                        runOnUiThread(() -> Toast.makeText(this, "Klasördeki JSON dosyaları okunamadı.", Toast.LENGTH_SHORT).show());
                    }
                }).start();
            }
        }
    }

    private void collectJsonFiles(Uri treeUri, JSONArray arr, int depth) throws Exception {
        if (depth > 8) return;
        String docId = DocumentsContract.getTreeDocumentId(treeUri);
        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
        collectJsonFilesFromDocument(treeUri, docUri, arr, depth);
    }

    private void collectJsonFilesFromDocument(Uri treeUri, Uri docUri, JSONArray arr, int depth) throws Exception {
        String[] projection = new String[]{
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE
        };
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, DocumentsContract.getDocumentId(docUri));
        try (Cursor cursor = getContentResolver().query(childrenUri, projection, null, null, null)) {
            if (cursor == null) return;
            while (cursor.moveToNext()) {
                String childId = cursor.getString(0);
                String name = cursor.getString(1);
                String mime = cursor.getString(2);
                Uri childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId);
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    if (depth < 8) collectJsonFilesFromDocument(treeUri, childUri, arr, depth + 1);
                } else if (name != null && name.toLowerCase().endsWith(".json")) {
                    JSONObject item = new JSONObject();
                    item.put("name", name);
                    item.put("content", readText(childUri));
                    arr.put(item);
                }
            }
        }
    }

    private String readText(Uri uri) throws Exception {
        try (InputStream in = getContentResolver().openInputStream(uri); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) return "";
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) != -1) out.write(buffer, 0, n);
            return out.toString("UTF-8");
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
