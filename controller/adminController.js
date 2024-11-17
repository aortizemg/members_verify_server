const User = require("../models/users");

getAssocList = async (req, res) => {
  try {
    // Fetch distinct assocCode and association names
    const assocList = await User.aggregate([
      {
        $group: {
          _id: { assocCode: "$assocCode", association: "$association" },
        },
      },
      {
        $project: {
          _id: 0,
          assocCode: "$_id.assocCode",
          association: "$_id.association",
        },
      },
      {
        $sort: { association: 1 }, // Sort by association in ascending order (alphabetical)
      },
    ]);

    // Send the response
    res.status(200).json({ success: true, assocList });
  } catch (error) {
    console.error("Error fetching assoc list:", error);
    res
      .status(500)
      .json({ success: false, message: "An error occurred", error });
  }
};

module.exports = { getAssocList };
