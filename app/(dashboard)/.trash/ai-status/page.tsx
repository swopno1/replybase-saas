// This route and UI have been removed. AI runtime and fallback are now managed per-channel.
        <CardHeader>
          <CardTitle className="text-base">Effective Response Scope</CardTitle>
          <CardDescription>
            This page controls AI runtime for Facebook pages only. Telegram and
            Webchat runtime mode are managed in their integration pages.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Engine Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Engine Connection
          </CardTitle>
          <CardDescription>Status of the AI engine service</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isEngineUp ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium">Online</div>
                    <div className="text-sm text-muted-foreground">
                      Connected
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <div className="font-medium">Offline</div>
                    <div className="text-sm text-muted-foreground">
                      Engine is not responding
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Facebook AI Runtime Status
          </CardTitle>
          <CardDescription>
            {isAIActive
              ? "AI runtime is active for one or more Facebook pages"
              : "AI runtime is currently disabled for Facebook pages"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isAIActive ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="font-medium text-lg">Active</div>
                    <div className="text-sm text-muted-foreground">
                      {activePagesCount} of {connectedPages.length} page
                      {connectedPages.length !== 1 ? "s" : ""} enabled
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium text-lg">Inactive</div>
                    <div className="text-sm text-muted-foreground">
                      Enable AI for your pages below
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connected Pages */}
      {connectedPages.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Pages Connected</CardTitle>
            <CardDescription>
              Connect a Facebook Page to enable AI replies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/integrations/facebook">
              <Button>Connect Facebook Page</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Facebook Pages</CardTitle>
            <CardDescription>
              Enable or disable AI replies for each page
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {connectedPages.map(
              (page: {
                id: string;
                name: string;
                engineConnected: boolean;
                facebookId: string;
                botId: string | null;
              }) => (
                <div
                  key={page.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{page.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {page.engineConnected ? (
                          <span className="text-green-600">AI Enabled</span>
                        ) : (
                          <span className="text-muted-foreground">
                            AI Disabled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <AIToggle
                    pageId={page.id}
                    enabled={page.engineConnected}
                    disabled={!isEngineUp}
                  />
                </div>
              ),
            )}
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm">How Runtime Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            When AI is enabled for a page, ReplyBase can generate automatic
            replies for incoming Facebook Messenger messages.
          </p>
          <p>
            System health (engine online or offline) and page-level runtime
            toggles are separate controls. Both must be healthy for AI replies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
