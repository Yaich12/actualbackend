content = "\n".join(
    [
        'CORTI_CLIENT_ID="selma-testv2"',
        'CORTI_CLIENT_SECRET="FriPz5pyMAO0vGVcwCiL3EuIwgXre0Q"',
        'CORTI_TENANT="base"',
        'CORTI_API_URL="https://api.eu.corti.app"',
        'CORTI_AUTH_URL="https://auth.eu.corti.app/realms/base/protocol/openid-connect/token"',
    ]
)

with open(".env", "w", encoding="utf-8") as env_file:
    env_file.write(content)
