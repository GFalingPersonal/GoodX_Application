{ pkgs, ... }: {
  channel = "stable-24.05"; # or "unstable"

  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools # Added firebase-tools
    pkgs.docker         # to run python in docker
    (pkgs.python311.withPackages (ps: [
      ps.flask
      ps.requests
      ps.python-dotenv
      ps.flask-cors
    ]))
  ];

  env = { };

  idx = {
    extensions = [ ];

    previews = {
      enable = true;
      previews = {
        # Frontend: serve static HTML/JS on port 9002
        web = {
          command = [ "python" "-m" "http.server" "9002" "--bind" "0.0.0.0" ];
          manager = "web";
        };
      };
    };

    workspace = {
      onStart = {
        # Backend (Flask proxy) runs automatically but is not a preview
        backend = "python backend_proxy.py";
      };
    };
  };
}
