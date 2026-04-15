exports.runArchiveJob = async (req, res) => {
  try {
    const result = await req.app.locals.chatArchiveService.archiveOldMessages();

    return res.status(200).json({
      message: "Archive job completed successfully",
      archivedCount: result.archivedCount
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to archive messages",
      error: error.message
    });
  }
};
