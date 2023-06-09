// Manages the session objects.

// Required libraries:
// import_code("../errors.gs")

if not globals.hasIndex("ContextLib") then globals.ContextLib = {}
ContextLib = globals.ContextLib

// AddSession() Add a new session object.
//
// Returns the new session object, or null if there was a problem connecting.
//
// The session will connect to the ip address on the port using the user name and password.
// If 'encrypt is not null, then it must be a function that takes the password and returns an
// encoded value back.  If 'source' is not null, then it indicates the session name or
// session object to use to make the connection.
ContextLib.AddSession = function(context, name, ipAddress, port, user, password, source=null, encrypt=null, env=null)
    // Developer note: updating the values in the session object requires
    // updating the `get.gs` script, tool.
    if context == null or not context isa map or not context.hasIndex("NamedSessions") then return null
    if encrypt != null then
        password = encrypt(password)
    end if
    if password == null or name == null or ipAddress == null or port == null or user == null or not password isa string or not name isa string or not ipAddress isa string or not port isa number or not user isa string then
        return null
    end if
    if source == null then source = "local"
    if source != null and source isa string and context.NamedSessions.hasIndex(source) then
        source = context.NamedSessions[source]
    end if
    if source == null then
        context.Errors.push(ErrorLib.Error.New("unknown source session", {"source": "AddSession"}))
        return null
    end if
    shell = source.shell.connect_service(ipAddress, port, user, password)
    if shell == null or shell isa string then
        context.Errors.push(ErrorLib.Error.New(
            "Failed connecting to {ipAddress}:{port} ({err})", {"source": "AddSession", "ipAddress": ipAddress, "port": port, "err": shell}))
        return null
    end if
    // Make a copy of the env
    if env == null then env = {}
    env = {} + env

    ret = {
        "Name": name,
        "Ip": ipAddress,
        "Home": "/home/" + user, // best guess
        "User": user,
        "Password": password,
        "Shell": shell,
        "Computer": shell.host_computer,
        "Cwd": "/home/" + user,
        "CwdR": "~",
        "CwdN": "~",
        "DirStack": [],
        "OnLogout": null,
        "OnLogoutPost": null,
        "OnLogin": null,
        "OnCmd": null,
        "OnCmdPost": null,
        "Parent": source.name,
        "Env": env,
    }
    context.NamedSessions[name] = ret
    if ContextLib.hasIndex("Log") then
        logger = ContextLib.Logger.New("session", context)
        logger.Info("Logged into {ip}", {
            "ip": shell.ip,
            "user": shell.user,
        })
    end if
    context.NamedSessionsOrder.push(name)
    return ret
end function

// GetSession() Get the named session.
ContextLib.GetSession = function(context, name=null)
    if context == null or not context isa map or not context.hasIndex("NamedSessions") then
        return null
    end if
    if name == null then name = context.CurrentSessionName
    if name == null then return null
    if not context.NamedSessions.hasIndex(name) then
        context.Errors.push(ErrorLib.Error.New(
            "No such active session: {name}", {"source": "GetSession", "name": name}))
        return null
    end if
    ret = context.NamedSessions[name]
    if ret.Shell == null then
        // Requires a login.
        if ret.Parent == null then
            context.Errors.push(ErrorLib.Error.New(
                "No known parent for session {name}", {"source": "GetSession", "name": name}))
            return null
        end if
        shell = ret.Parent.Shell.connect_service(ipAddress, port, user, password)
        if shell == null or shell isa string then
            context.Errors.push(ErrorLib.Error.New(
                "Failed connecting to {ipAddress}:{port} ({err})", {"source": "GetSession", "ipAddress": ipAddress, "port": port, err: shell}))
            return null
        end if
        ret.Shell = shell
        ret.Computer = shell.host_computer
        logger = ContextLib.Logger.New("session", context)
        logger.Info("Logged into {ip}", {
            "ip": shell.ip,
            "user": shell.user,
        })
        // Does nothing if not a function, calls if a function.
        ret.OnLogin
    end if
    return ret
end function

// SessionLogout() Logs out of the session if it is currently logged in.
//
// Does not close the session.  If the session was successfully logged out, then
// a later GetSession will cause a login.
ContextLib.SessionLogout = function(context, name=null)
    if context == null or not context isa map or not context.hasIndex("NamedSessions") then return null
    if name == null then name = context.CurrentSessionName
    if name == null then return null
    if not context.NamedSessions.hasIndex(name) then
        context.Errors.push(ErrorLib.Error.New(
            "No such active session: {name}", {"source": "SessionLogout", "name": name}))
        return null
    end if
    ret = context.NamedSessions[name]
    if ret.Shell != null then
        // Does nothing if not a function, calls if a function.
        ret.OnLogout
        
        logger = ContextLib.Logger.New("session", context)
        logger.Info("Logged out of {ip}", {
            "ip": ret.Ip,
            "user": ret.User,
        })

        // Note: there is no proper "log out" operation.
        ret.Shell = null

        ret.OnLogoutPost
        return true
    end if
    return false
end function

// CloseSession() Close the given session.  Logs out if necessary.
ContextLib.CloseSession = function(context, name=null)
    if context == null or not context isa map or not context.hasIndex("NamedSessions") then return null
    if name == null then name = context.CurrentSessionName
    if context.NamedSessions.hasIndex(name) then
        ContextLib.SessionLogout(context, name)
        context.NamedSessions.remove(name)
        for idx in context.NamedSessionsOrder.indexes
            if context.NamedSessionsOrder[idx] == name then
                context.NamedSessionsOrder.remove(idx)
                break
            end if
        end for
    end if
    if name == context.CurrentSessionName then
        if context.NamedSessionsOrder.len > 0 then
            context.CurrentSessionName = context.NamedSessionsOrder[-1]
        else
            context.CurrentSessionName = null
        end if
    end if
end function
